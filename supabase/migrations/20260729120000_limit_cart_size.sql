-- =============================================================================
-- Nordo — górny limit pozycji w koszyku
--
-- `create_order()` i `quote_order()` iterują po tablicy przysłanej przez
-- przeglądarkę. Nic nie ograniczało jej długości: żądanie z pięcioma tysiącami
-- pozycji zajmowało bazę na tyle długo, że wystarczyło kilka takich naraz,
-- żeby popsuć zakupy wszystkim. Wejście od klienta zawsze potrzebuje sufitu.
--
-- 50 pozycji to z zapasem więcej, niż zbiera się w tym sklepie; limit dotyczy
-- liczby *różnych* produktów, nie sztuk.
-- =============================================================================

create or replace function public.quote_order(
  p_items jsonb,
  p_coupon text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item jsonb;
  prod public.products;
  qty integer;
  settings public.store_settings;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := 0;
  v_percent integer;
  v_coupon text;
  v_coupon_valid boolean := false;
  v_lines jsonb := '[]'::jsonb;
  v_missing integer;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 then
    raise exception 'Za dużo pozycji w koszyku (maksimum 50)';
  end if;

  select * into settings from public.store_settings where id;

  v_coupon := upper(nullif(trim(p_coupon), ''));

  for item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    qty := coalesce((item ->> 'qty')::integer, 0);
    if qty <= 0 then
      continue;
    end if;

    select * into prod
    from public.products
    where id = (item ->> 'product_id')::uuid and is_active;

    -- Produkt zniknął z katalogu albo został wyłączony — pomijamy go w wycenie,
    -- a create_order i tak odrzuci takie zamówienie.
    if prod.id is null then
      continue;
    end if;

    v_subtotal := v_subtotal + prod.price_cents * qty;

    v_lines := v_lines || jsonb_build_object(
      'product_id', prod.id,
      'name', prod.name,
      'unit_price_cents', prod.price_cents,
      'qty', qty,
      'line_total_cents', prod.price_cents * qty,
      'stock', prod.stock,
      'in_stock', prod.stock >= qty
    );
  end loop;

  if v_coupon is not null then
    select c.percent_off into v_percent
    from public.coupons c
    where c.code = v_coupon
      and c.is_active
      and (c.valid_from is null or c.valid_from <= now())
      and (c.valid_to is null or c.valid_to >= now())
      and (c.max_uses is null or c.used_count < c.max_uses);

    if v_percent is not null then
      v_coupon_valid := true;
      -- Ten sam wzór co w create_order — dzielenie całkowite, grosze w dół
      v_discount := (v_subtotal * v_percent) / 100;
    end if;
  end if;

  if v_subtotal = 0 then
    v_shipping := 0;
  elsif (v_subtotal - v_discount) >= settings.free_shipping_threshold_cents then
    v_shipping := 0;
  else
    v_shipping := settings.shipping_flat_cents;
  end if;

  v_missing := greatest(settings.free_shipping_threshold_cents - (v_subtotal - v_discount), 0);

  return jsonb_build_object(
    'subtotal_cents', v_subtotal,
    'discount_cents', v_discount,
    'shipping_cents', v_shipping,
    'total_cents', v_subtotal - v_discount + v_shipping,
    'coupon', v_coupon,
    'coupon_valid', v_coupon_valid,
    'percent_off', coalesce(v_percent, 0),
    'free_shipping_threshold_cents', settings.free_shipping_threshold_cents,
    'free_shipping_missing_cents', case when v_shipping = 0 then 0 else v_missing end,
    'currency', settings.currency,
    'lines', v_lines
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Ten sam limit przy składaniu zamówienia. Sprawdzenie idzie przed
-- jakimkolwiek zapisem, więc odrzucone żądanie nie zostawia po sobie wiersza.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_email text,
  p_phone text default null,
  p_shipping_address jsonb default null,
  p_coupon text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  prod public.products;
  qty integer;
  new_order public.orders;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := 0;
  v_percent integer := 0;
  v_coupon text;
  settings public.store_settings;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Puste zamówienie';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Za dużo pozycji w koszyku (maksimum 50)';
  end if;

  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Nieprawidłowy adres e-mail';
  end if;

  select * into settings from public.store_settings where id;

  v_coupon := upper(nullif(trim(p_coupon), ''));

  -- Kupon weryfikujemy zanim powstanie zamówienie
  if v_coupon is not null then
    select c.percent_off into v_percent
    from public.coupons c
    where c.code = v_coupon
      and c.is_active
      and (c.valid_from is null or c.valid_from <= now())
      and (c.valid_to is null or c.valid_to >= now())
      and (c.max_uses is null or c.used_count < c.max_uses);

    if v_percent is null then
      raise exception 'Kod rabatowy % jest nieprawidłowy lub wygasł', v_coupon;
    end if;
  end if;

  insert into public.orders (user_id, email, phone, shipping_address, coupon_code)
  values (auth.uid(), lower(trim(p_email)), p_phone, p_shipping_address, v_coupon)
  returning * into new_order;

  -- Blokujemy wiersze produktów w stałej kolejności — bez tego dwa równoległe
  -- zamówienia na te same pozycje mogą się zakleszczyć.
  for item in
    select value from jsonb_array_elements(p_items)
    order by (value ->> 'product_id')
  loop
    qty := coalesce((item ->> 'qty')::integer, 0);
    if qty <= 0 then
      raise exception 'Nieprawidłowa ilość dla produktu %', item ->> 'product_id';
    end if;

    select * into prod
    from public.products
    where id = (item ->> 'product_id')::uuid and is_active
    for update;

    if prod.id is null then
      raise exception 'Produkt % niedostępny', item ->> 'product_id';
    end if;

    if not public.take_stock(prod.id, qty, 'zamówienie', new_order.id) then
      raise exception 'Za mało sztuk: % (dostępne %)', prod.name, prod.stock;
    end if;

    insert into public.order_items (order_id, product_id, name, unit_price_cents, qty, line_total_cents)
    values (new_order.id, prod.id, prod.name, prod.price_cents, qty, prod.price_cents * qty);

    v_subtotal := v_subtotal + prod.price_cents * qty;
  end loop;

  -- Rabat naliczany od sumy pozycji
  if v_coupon is not null then
    v_discount := (v_subtotal * v_percent) / 100;
    update public.coupons set used_count = used_count + 1 where code = v_coupon;
  end if;

  -- Dostawa
  if (v_subtotal - v_discount) >= settings.free_shipping_threshold_cents then
    v_shipping := 0;
  else
    v_shipping := settings.shipping_flat_cents;
  end if;

  update public.orders
  set subtotal_cents = v_subtotal,
      discount_cents = v_discount,
      shipping_cents = v_shipping,
      total_cents = v_subtotal - v_discount + v_shipping
  where id = new_order.id
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function public.quote_order(jsonb, text) to anon, authenticated;
grant execute on function public.create_order(jsonb, text, text, jsonb, text) to anon, authenticated;
