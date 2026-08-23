-- =============================================================================
-- Nordo — zgoda na regulamin zapisywana razem z zamówieniem
--
-- Stan zastany: formularz zamówienia zbierał imię, telefon, e-mail i adres,
-- a nie było w nim ani pola zgody, ani odnośnika do regulaminu i polityki.
-- Gorsze od braku pola było to, że **nie było gdzie zgody zapisać**: `orders`
-- nie miało na to kolumn, a `create_order()` nie przyjmowało takiego
-- parametru. Dołożenie samego checkboxa dałoby więc pozór zgodności —
-- przy pierwszej reklamacji i tak nie dałoby się odtworzyć, na co klient się
-- zgodził i w jakim brzmieniu.
--
-- Dlatego kolejność jest taka: najpierw miejsce na zapis i wymuszenie go
-- w bazie, dopiero potem pole w interfejsie.
--
-- Wersja dokumentu, a nie samo „true": treść regulaminu będzie się zmieniać,
-- a zgoda dotyczy konkretnego brzmienia. Trzymamy znacznik wersji z
-- `web/lib/dane-sklepu.ts` (WERSJA_DOKUMENTOW) — jedno miejsce dla strony
-- i dla bazy.
-- =============================================================================

alter table public.orders
  add column if not exists zgoda_wersja text,
  add column if not exists zgoda_at timestamptz;

comment on column public.orders.zgoda_wersja is
  'Wersja regulaminu i polityki prywatności zaakceptowana przy składaniu zamówienia.';
comment on column public.orders.zgoda_at is
  'Kiedy zgoda została udzielona. Razem z wersją odtwarza brzmienie dokumentu.';

-- Zamówienia sprzed tej zmiany zostają bez wersji — udawanie, że zgoda była,
-- byłoby fałszowaniem zapisu. `null` mówi prawdę: nie wiemy.

-- ---------------------------------------------------------------------------
-- create_order przyjmuje wersję dokumentu i bez niej odmawia
--
-- Ciało funkcji jest przeniesione z 20260807160000 bez zmian poza trzema
-- miejscami (sygnatura, sprawdzenie zgody, zapis). Zachowane zostają wszystkie
-- dotychczasowe gwarancje: blokowanie wierszy produktów w stałej kolejności,
-- warunek limitu kuponu w jednej instrukcji z podniesieniem licznika oraz
-- odmowa przy niewystarczającym stanie.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_email text,
  p_phone text default null,
  p_shipping_address jsonb default null,
  p_coupon text default null,
  p_zgoda_wersja text default null
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
  v_uzyte integer;
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

  -- Zgoda na regulamin i przyjęcie klauzuli informacyjnej. Sprawdzenie stoi
  -- tutaj, a nie tylko w formularzu, bo funkcja jest wywoływalna wprost przez
  -- /rest/v1/rpc — a zamówienie bez zapisanej zgody jest bezużyteczne przy
  -- pierwszej reklamacji: nie da się odtworzyć, na co klient się zgodził.
  if p_zgoda_wersja is null or btrim(p_zgoda_wersja) = '' then
    raise exception 'Brak zgody na regulamin i politykę prywatności';
  end if;

  select * into settings from public.store_settings where id;

  v_coupon := upper(nullif(trim(p_coupon), ''));

  -- Kupon weryfikujemy zanim powstanie zamówienie — żeby zły kod nie
  -- zostawiał po sobie wiersza i zdjętego stanu.
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

  insert into public.orders (
    user_id, email, phone, shipping_address, coupon_code,
    zgoda_wersja, zgoda_at
  )
  values (
    auth.uid(), lower(trim(p_email)), p_phone, p_shipping_address, v_coupon,
    btrim(p_zgoda_wersja), now()
  )
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

  -- Podniesienie licznika i warunek limitu w jednej instrukcji
  if v_coupon is not null then
    update public.coupons
    set used_count = used_count + 1
    where code = v_coupon
      and is_active
      and (valid_from is null or valid_from <= now())
      and (valid_to is null or valid_to >= now())
      and (max_uses is null or used_count < max_uses);

    get diagnostics v_uzyte = row_count;

    if v_uzyte = 0 then
      raise exception 'Kod rabatowy % został właśnie wykorzystany do końca', v_coupon;
    end if;

    v_discount := (v_subtotal * v_percent) / 100;
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

-- Stara sygnatura znika — inaczej pod /rest/v1/rpc zostałoby wejście
-- przyjmujące zamówienie bez zgody, czyli dokładnie to, co zamykamy.
drop function if exists public.create_order(jsonb, text, text, jsonb, text);

grant execute on function public.create_order(jsonb, text, text, jsonb, text, text)
  to anon, authenticated;
