-- =============================================================================
-- Nordo — role, uprawnienia i logika handlowa
-- Wszystko, co dotyka cen i stanów magazynowych, liczy się TUTAJ.
-- Klient przysyła wyłącznie identyfikatory produktów i ilości.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Rola bieżącego użytkownika
-- Najpierw claim z JWT (bez zapytania do bazy), w razie braku — tabela.
-- Fallback ratuje sytuację, gdy hook custom_access_token nie jest jeszcze włączony
-- albo token został wydany przed nadaniem roli.
-- ---------------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.app_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claim text;
  found_role public.app_role;
begin
  if auth.uid() is null then
    return null;
  end if;

  claim := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_role',
    null
  );

  if claim is not null then
    return claim::public.app_role;
  end if;

  select ur.role into found_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by array_position(
    array['owner', 'manager', 'staff', 'customer']::public.app_role[], ur.role
  )
  limit 1;

  return found_role;
end;
$$;

-- Czy bieżący użytkownik ma dane uprawnienie
create or replace function public.authorize(requested_permission public.app_permission)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name public.app_role;
  allowed boolean;
begin
  role_name := public.current_role_name();
  if role_name is null then
    return false;
  end if;

  select exists (
    select 1
    from public.role_permissions rp
    where rp.role = role_name
      and rp.permission = requested_permission
  ) into allowed;

  return coalesce(allowed, false);
end;
$$;

-- Skrót: ktokolwiek z zaplecza
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('owner', 'manager', 'staff'), false);
$$;

-- ---------------------------------------------------------------------------
-- Hook wzbogacający access token o rolę.
-- Włączenie: Dashboard → Authentication → Hooks → Customize Access Token,
-- albo w supabase/config.toml (sekcja auth.hook.custom_access_token).
-- ---------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role public.app_role;
begin
  select ur.role into user_role
  from public.user_roles ur
  where ur.user_id = (event ->> 'user_id')::uuid
  order by array_position(
    array['owner', 'manager', 'staff', 'customer']::public.app_role[], ur.role
  )
  limit 1;

  claims := event -> 'claims';

  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- ---------------------------------------------------------------------------
-- Zdejmowanie stanu magazynowego.
-- Warunkowy UPDATE zamiast "odczytaj, odejmij, zapisz" — dwa równoległe
-- zamówienia nie zejdą poniżej zera, bo warunek sprawdza się w tej samej
-- instrukcji, która zapisuje.
-- ---------------------------------------------------------------------------
create or replace function public.take_stock(
  p_product_id uuid,
  p_qty integer,
  p_reason text default 'zamówienie',
  p_order_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if p_qty <= 0 then
    raise exception 'Ilość musi być dodatnia';
  end if;

  update public.products
  set stock = stock - p_qty
  where id = p_product_id
    and stock >= p_qty;

  get diagnostics affected = row_count;

  if affected = 0 then
    return false;
  end if;

  insert into public.inventory_movements (product_id, delta, reason, order_id, created_by)
  values (p_product_id, -p_qty, p_reason, p_order_id, auth.uid());

  return true;
end;
$$;

-- Zwrot na magazyn (anulowanie, zwrot towaru, korekta)
create or replace function public.return_stock(
  p_product_id uuid,
  p_qty integer,
  p_reason text default 'zwrot',
  p_order_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products set stock = stock + p_qty where id = p_product_id;

  insert into public.inventory_movements (product_id, delta, reason, order_id, created_by)
  values (p_product_id, p_qty, p_reason, p_order_id, auth.uid());
end;
$$;

-- Ręczna korekta stanu przez magazyniera
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock integer;
begin
  if not public.authorize('inventory.write') then
    raise exception 'Brak uprawnień do zmiany stanu magazynowego';
  end if;

  update public.products
  set stock = greatest(0, stock + p_delta)
  where id = p_product_id
  returning stock into new_stock;

  if new_stock is null then
    raise exception 'Nie ma produktu o id %', p_product_id;
  end if;

  insert into public.inventory_movements (product_id, delta, reason, created_by)
  values (p_product_id, p_delta, p_reason, auth.uid());

  return new_stock;
end;
$$;

-- ---------------------------------------------------------------------------
-- Złożenie zamówienia.
-- p_items: [{"product_id": "...", "qty": 2}, ...]
-- Ceny, rabat i dostawa liczone z bazy — to, co przyszło z przeglądarki,
-- służy wyłącznie do wskazania produktu i ilości.
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

-- ---------------------------------------------------------------------------
-- Potwierdzenie płatności — wołane wyłącznie z webhooka operatora
-- (Edge Function z kluczem service_role). Idempotentne: powtórka tego samego
-- webhooka nie zmienia niczego drugi raz.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_provider text,
  p_payment_intent text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.orders;
begin
  update public.orders
  set payment_status = 'opłacone',
      status = case when status = 'nowe' then 'w realizacji' else status end,
      payment_provider = p_provider,
      payment_intent_id = p_payment_intent
  where id = p_order_id
    and payment_status <> 'opłacone'
  returning * into updated;

  if updated.id is null then
    select * into updated from public.orders where id = p_order_id;
  end if;

  return updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulowanie zamówienia — zwraca towar na magazyn
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders;
  line public.order_items;
begin
  select * into target from public.orders where id = p_order_id;

  if target.id is null then
    raise exception 'Nie ma zamówienia %', p_order_id;
  end if;

  if not coalesce(
       public.authorize('orders.write')
         or (target.user_id is not null and auth.uid() is not null and target.user_id = auth.uid()),
       false
     ) then
    raise exception 'Brak uprawnień do anulowania tego zamówienia';
  end if;

  if target.status = 'anulowane' then
    return target;
  end if;

  for line in select * from public.order_items where order_id = p_order_id loop
    if line.product_id is not null then
      perform public.return_stock(line.product_id, line.qty, 'anulowanie zamówienia', p_order_id);
    end if;
  end loop;

  update public.orders set status = 'anulowane' where id = p_order_id returning * into target;
  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uprawnienia wykonywania
-- ---------------------------------------------------------------------------
revoke execute on function public.take_stock(uuid, integer, text, uuid) from anon, authenticated;
revoke execute on function public.return_stock(uuid, integer, text, uuid) from anon, authenticated;
revoke execute on function public.mark_order_paid(uuid, text, text) from anon, authenticated;

grant execute on function public.create_order(jsonb, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;
grant execute on function public.authorize(public.app_permission) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
