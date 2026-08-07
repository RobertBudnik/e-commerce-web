-- =============================================================================
-- Nordo — granice stanów zamówień, zwrotów i kuponów
--
-- Wspólny mianownik wszystkich poprawek w tej migracji: interfejs ograniczał
-- operacje, których baza nie ograniczała. Przycisk „Anuluj" pokazywał się
-- wyłącznie przy zamówieniu w stanie „nowe", formularz zwrotu wyłącznie przy
-- „dostarczone" — ale funkcje sprawdzały tylko, KTO woła, nigdy W JAKIM STANIE
-- jest zamówienie. Klucz `anon` jest publiczny i leży w kodzie strony, więc
-- każdy zalogowany mógł wywołać RPC z palca, omijając cały interfejs.
--
-- Sprawdzone na żywej bazie przed napisaniem tej migracji, nie z lektury.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Anulowanie: klient wyłącznie przed opłaceniem i przed ruszeniem paczki
--
-- Sonda: zamówienie na 2 szt., stan 120 → 118. Ustawione na „dostarczone"
-- i „opłacone", po czym klient wołał cancel_order z własnym tokenem:
--
--   status_po_anulowaniu: anulowane
--   stan magazynu: 120        payment_status: opłacone
--
-- Dwie sztuki fizycznie u klienta wróciły do ewidencji, a zamówienie było
-- jednocześnie anulowane i opłacone — bez śladu zwrotu pieniędzy.
--
-- Zaplecze zostaje bez ograniczeń: anulowanie wysłanej paczki po telefonie od
-- klienta to normalna praca obsługi, a `orders.write` ma tylko ktoś, komu
-- właściciel to prawo nadał. Ograniczenie dotyczy wyłącznie samoobsługi.
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
  zaplecze boolean;
  wlasciciel boolean;
begin
  select * into target from public.orders where id = p_order_id;

  if target.id is null then
    raise exception 'Nie ma zamówienia %', p_order_id;
  end if;

  zaplecze := coalesce(public.authorize('orders.write'), false);
  wlasciciel := target.user_id is not null
    and auth.uid() is not null
    and target.user_id = auth.uid();

  if not (zaplecze or wlasciciel) then
    raise exception 'Brak uprawnień do anulowania tego zamówienia';
  end if;

  -- Klient anuluje własne zamówienie tylko dopóki nic się z nim nie stało.
  -- Po opłaceniu wchodzi zwrot pieniędzy, po wysyłce — zwrot towaru; jedno
  -- i drugie robi obsługa, bo jedno i drugie ma skutek poza bazą.
  if not zaplecze then
    if target.payment_status = 'opłacone' then
      raise exception 'Zamówienie jest opłacone — anulowanie prowadzi przez obsługę sklepu';
    end if;

    if target.status <> 'nowe' then
      raise exception 'Zamówienie jest już w realizacji — anulowanie prowadzi przez obsługę sklepu';
    end if;
  end if;

  if target.status = 'anulowane' then
    return target;
  end if;

  for line in select * from public.order_items where order_id = p_order_id loop
    if line.product_id is not null then
      perform public.return_stock(line.product_id, line.qty, 'anulowanie zamówienia', p_order_id);
    end if;
  end loop;

  -- Znacznik dla wyzwalacza niżej: ten jeden UPDATE ma prawo postawić stan
  -- „anulowane", bo towar właśnie wrócił na magazyn. Ustawienie jest lokalne
  -- dla transakcji, więc nie przecieka do kolejnego żądania w tej samej sesji.
  perform set_config('nordo.anulowanie', 'on', true);

  update public.orders set status = 'anulowane' where id = p_order_id returning * into target;

  perform set_config('nordo.anulowanie', 'off', true);

  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Stan „anulowane" wyłącznie przez cancel_order
--
-- Polityka „zamówienia: obsługa" przepuszcza zwykły UPDATE na `orders` dla
-- każdego z uprawnieniem `orders.write`. Panel konta robi to poprawnie —
-- przy wyborze „anulowane" woła cancelOrderAction, nie UPDATE. Ale samo API
-- stoi otworem i surowy UPDATE przestawia status bez zwrotu towaru:
--
--   zamówienie na 3 szt., stan 124 → 121
--   update orders set status = 'anulowane'  →  stan dalej 121
--
-- Ta sama operacja przez cancel_order daje 124. Dwie drogi, dwa wyniki —
-- magazyn rozjeżdża się po cichu i nikt nie umie potem wskazać kiedy.
--
-- Wyzwalacz zamyka drogę na skróty, zamiast liczyć na to, że każdy kolejny
-- ekran pamięta, którą funkcję wypada zawołać.
-- ---------------------------------------------------------------------------
create or replace function public.pilnuj_anulowania()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'anulowane'
     and old.status is distinct from 'anulowane'
     and coalesce(current_setting('nordo.anulowanie', true), 'off') <> 'on' then
    raise exception 'Anulowanie idzie przez cancel_order() — inaczej towar nie wróci na magazyn'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_pilnuj_anulowania on public.orders;
create trigger orders_pilnuj_anulowania
  before update on public.orders
  for each row execute function public.pilnuj_anulowania();

revoke execute on function public.pilnuj_anulowania() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Zwrot: tylko po dostarczeniu i tylko do wysokości tego, co zostało
--
-- zglos_zwrot() porównywało ilość z pojedynczą pozycją zamówienia, ale nie
-- sumowało zwrotów już zgłoszonych. Sonda — zamówienie na 2 szt., trzy
-- zgłoszenia po 2 szt.:
--
--   zgłoszeń: 3   sztuk zgłoszonych: 6
--   magazyn przyjmuje wszystkie trzy → 2 | 2 | 2
--   stan: 120 → 118 (zamówienie) → 124
--
-- Cztery sztuki z powietrza. Magazynier widzi w kolejce trzy osobne zwroty
-- i nie ma po czym poznać, że pochodzą z jednego zamówienia.
--
-- Zwroty odrzucone nie liczą się do puli: towar nie wrócił, więc nie ma
-- powodu blokować klientowi ponownego zgłoszenia.
-- ---------------------------------------------------------------------------
create or replace function public.zglos_zwrot(
  p_zamowienie uuid,
  p_pozycje jsonb,
  p_powod text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zwrot uuid;
  pozycja jsonb;
  produkt uuid;
  ile integer;
  zamowione integer;
  juz_zwrocone integer;
  stan_zamowienia public.order_status;
begin
  select status into stan_zamowienia
  from public.orders
  where id = p_zamowienie and user_id = auth.uid();

  if stan_zamowienia is null then
    raise exception 'To nie jest Twoje zamówienie';
  end if;

  -- Zwrot dotyczy towaru, który klient ma w ręku. Przed dostarczeniem to nie
  -- jest zwrot, tylko anulowanie — i idzie inną drogą.
  if stan_zamowienia <> 'dostarczone' then
    raise exception 'Zwrot można zgłosić dopiero po dostarczeniu zamówienia';
  end if;

  if jsonb_array_length(coalesce(p_pozycje, '[]'::jsonb)) = 0 then
    raise exception 'Wskaż, co odsyłasz';
  end if;

  insert into public.zwroty (order_id, powod)
  values (p_zamowienie, nullif(btrim(p_powod), ''))
  returning id into v_zwrot;

  for pozycja in select * from jsonb_array_elements(p_pozycje) loop
    produkt := (pozycja ->> 'product_id')::uuid;
    ile := (pozycja ->> 'qty')::integer;

    if ile is null or ile <= 0 then
      raise exception 'Nieprawidłowa ilość zwracana';
    end if;

    select qty into zamowione
    from public.order_items
    where order_id = p_zamowienie and product_id = produkt;

    if zamowione is null then
      raise exception 'Pozycji nie było w tym zamówieniu';
    end if;

    -- Suma po wszystkich wcześniejszych zgłoszeniach tego zamówienia,
    -- bez bieżącego (wiersz jeszcze nie istnieje) i bez odrzuconych.
    select coalesce(sum(zp.qty), 0) into juz_zwrocone
    from public.zwroty z
    join public.zwroty_pozycje zp on zp.zwrot_id = z.id
    where z.order_id = p_zamowienie
      and z.id <> v_zwrot
      and z.status <> 'odrzucony'
      and zp.product_id = produkt;

    if juz_zwrocone + ile > zamowione then
      raise exception 'W zamówieniu było % szt., zgłoszono już % — nie można zwrócić kolejnych %',
        zamowione, juz_zwrocone, ile;
    end if;

    insert into public.zwroty_pozycje (zwrot_id, product_id, name, qty)
    select v_zwrot, oi.product_id, oi.name, ile
    from public.order_items oi
    where oi.order_id = p_zamowienie and oi.product_id = produkt;
  end loop;

  return v_zwrot;
end;
$$;

revoke execute on function public.zglos_zwrot(uuid, jsonb, text) from public, anon, service_role;
grant execute on function public.zglos_zwrot(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Nie nadajemy przesyłki na anulowane zamówienie
--
-- Sonda: zamówienie anulowane (towar wrócił na stan) → nadaj_przesylke →
-- numer „PACZKA-123", status „wysłane". Paczka wyjeżdża, a towar figuruje
-- w magazynie jako obecny.
-- ---------------------------------------------------------------------------
create or replace function public.nadaj_przesylke(
  p_zamowienie uuid,
  p_numer text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  numer text;
  stan public.order_status;
begin
  if not public.authorize('orders.write') then
    raise exception 'Brak uprawnień do zmiany zamówienia';
  end if;

  if coalesce(btrim(p_numer), '') = '' then
    raise exception 'Numer przesyłki jest wymagany';
  end if;

  -- Powtórne nadanie nie nadpisuje numeru: paczka ma jeden list przewozowy,
  -- a drugie dotknięcie przycisku to zwykle ta sama paczka, nie nowa.
  select numer_przesylki, status into numer, stan
  from public.orders where id = p_zamowienie for update;

  if stan is null then
    raise exception 'Nie ma zamówienia o id %', p_zamowienie;
  end if;

  if numer is not null and btrim(numer) <> '' then
    return numer;
  end if;

  if stan = 'anulowane' then
    raise exception 'Zamówienie jest anulowane — towar wrócił na magazyn';
  end if;

  update public.orders
  set numer_przesylki = btrim(p_numer),
      status = 'wysłane'
  where id = p_zamowienie
  returning numer_przesylki into numer;

  return numer;
end;
$$;

revoke execute on function public.nadaj_przesylke(uuid, text) from public, anon, service_role;
grant execute on function public.nadaj_przesylke(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Kolejka pakowania przestawia wyłącznie stany kolejki
--
-- Komentarz przy funkcji mówił „kolejka pakowania", akcja serwerowa
-- przepuszczała `nowe` i `spakowane`, a sama funkcja przyjmowała wszystko
-- poza `wysłane`. Sonda: ustaw_stan_zamowienia(..., 'dostarczone') → działa.
-- Ta sama droga stawiała też `anulowane`, bez zwrotu towaru (patrz punkt 2).
-- ---------------------------------------------------------------------------
create or replace function public.ustaw_stan_zamowienia(
  p_zamowienie uuid,
  p_stan order_status
)
returns order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  wynik order_status;
begin
  if not public.authorize('orders.write') then
    raise exception 'Brak uprawnień do zmiany zamówienia';
  end if;

  -- Wysyłkę nadaje `nadaj_przesylke`, razem z numerem listu. Anulowanie —
  -- `cancel_order`, bo musi zwrócić towar. Zostają dwa stany samej kolejki.
  if p_stan not in ('nowe', 'spakowane') then
    raise exception 'Ta funkcja przestawia wyłącznie „nowe" i „spakowane"';
  end if;

  update public.orders set status = p_stan
  where id = p_zamowienie
  returning status into wynik;

  if wynik is null then
    raise exception 'Nie ma zamówienia o id %', p_zamowienie;
  end if;

  return wynik;
end;
$$;

revoke execute on function public.ustaw_stan_zamowienia(uuid, order_status) from public, anon, service_role;
grant execute on function public.ustaw_stan_zamowienia(uuid, order_status) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Kupon nie przekroczy limitu użyć
--
-- Sprawdzenie `used_count < max_uses` i podniesienie licznika dzieliła cała
-- reszta funkcji — kilkadziesiąt milisekund bez blokady wiersza. Dwa
-- zamówienia składane w tej samej chwili na ostatnie użycie przechodziły oba.
--
-- Teraz warunek jest częścią UPDATE-u: Postgres blokuje wiersz kuponu na czas
-- zapisu, więc drugie zamówienie widzi już podniesiony licznik i odbija się.
-- Zero trafionych wierszy znaczy „ktoś był pierwszy".
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

grant execute on function public.create_order(jsonb, text, text, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. adjust_stock znika
--
-- Zastąpiona przez `koryguj_stan` w 20260806090100. Tamta nie ścina stanu do
-- zera po cichu, blokuje wiersz i przyjmuje klucz idempotencji. Ostatni ekran
-- używający adjust_stock (StockRow) odchodzi razem z tą migracją, więc
-- zostawianie funkcji znaczyłoby tylko tyle, że pod /rest/v1/rpc wisi wejście
-- zdejmujące stan bez żadnej z tych trzech gwarancji.
-- ---------------------------------------------------------------------------
drop function if exists public.adjust_stock(uuid, integer, text);
