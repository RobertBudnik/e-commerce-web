-- =============================================================================
-- Pola pod aplikację magazynową
--
-- Widok /magazyn w powłoce na telefonie potrzebuje czterech rzeczy, których
-- schemat nie miał. Każda z nich była dotąd albo zmyślana w kodzie, albo
-- nie istniała wcale:
--
--   products.sku            magazynier szuka po symbolu z etykiety, nie po
--                           adresie URL; `slug` służy sklepowi, `barcode` to
--                           EAN z opakowania — symbolu wewnętrznego nie było
--   products.prog_niski     próg ostrzegawczy siedział jako stała `PROG_NISKI = 5`
--                           wpisana w dwóch miejscach w kodzie front-endu,
--                           jednakowa dla żarówki i dla laptopa
--   orders.numer_przesylki  po nadaniu paczki numer listu nie miał gdzie usiąść
--   inventory_movements.notatka
--                           powód korekty jest z listy, ale „uszkodzone przy
--                           rozładunku, karton 3" nie mieści się w liście
--
-- Piąta kolumna, `klucz_operacji`, nie jest polem widocznym w interfejsie —
-- odpowiada za to, żeby dwukrotne dotknięcie przycisku zapisu nie zrobiło
-- dwóch ruchów magazynowych. Bez niej idempotencji nie da się zagwarantować
-- po stronie bazy, a to jedyne miejsce, gdzie ma sens.
-- =============================================================================

-- ---------- Produkty ----------

alter table public.products
  add column if not exists sku text,
  add column if not exists prog_niski integer not null default 5;

alter table public.products
  drop constraint if exists products_prog_niski_nieujemny;
alter table public.products
  add constraint products_prog_niski_nieujemny check (prog_niski >= 0);

-- Symbol jest opcjonalny, ale jeśli już jest — musi być jeden. Indeks
-- częściowy, bo `unique` na kolumnie z wieloma NULL-ami przepuszcza NULL-e,
-- a chcemy tego wprost, nie przez przypadek.
create unique index if not exists products_sku_unikalny
  on public.products (sku) where sku is not null;

comment on column public.products.sku is
  'Symbol wewnętrzny z etykiety magazynowej. Nie mylić ze `slug` (adres w sklepie) ani `barcode` (EAN z opakowania).';
comment on column public.products.prog_niski is
  'Stan, przy którym magazyn zapala ostrzeżenie. Zero wyłącza ostrzeganie dla tej pozycji.';

-- ---------- Zamówienia ----------

alter table public.orders
  add column if not exists numer_przesylki text;

comment on column public.orders.numer_przesylki is
  'Numer listu przewozowego nadany przy wysyłce. Puste, dopóki paczka nie wyjechała.';

-- ---------- Ruchy magazynowe ----------

alter table public.inventory_movements
  add column if not exists notatka text,
  add column if not exists klucz_operacji uuid;

create unique index if not exists ruchy_klucz_operacji_unikalny
  on public.inventory_movements (klucz_operacji) where klucz_operacji is not null;

comment on column public.inventory_movements.klucz_operacji is
  'Klucz idempotencji. Powtórzone wysłanie tej samej korekty trafia w unikalny indeks i nie dubluje ruchu.';

-- =============================================================================
-- Korekta stanu z aplikacji
--
-- `adjust_stock` zostaje bez zmian — używa jej dotychczasowy widok stanów.
-- Nowa funkcja różni się trzema rzeczami, z których każda wynika z pracy
-- na telefonie:
--
-- 1. Nie ścina stanu do zera po cichu. `adjust_stock` robi
--    `greatest(0, stock + delta)`, więc próba zdjęcia pięciu sztuk z trzech
--    kończyła się zerem i komunikatem „zapisano" — magazynier nie miał jak
--    zauważyć, że dwie sztuki zniknęły z ewidencji. Tu leci wyjątek z liczbami,
--    a interfejs pokazuje go przy liczbie, nie w okienku.
--
-- 2. Blokuje wiersz produktu na czas operacji. Dwa telefony korygujące ten sam
--    produkt w tej samej sekundzie policzyłyby stan z tego samego odczytu
--    i drugi zapis nadpisałby pierwszy. `for update` ustawia je w kolejce.
--
-- 3. Przyjmuje klucz operacji. Powtórka tego samego żądania — dwukrotne
--    dotknięcie, ponowienie po zerwanej sieci — zwraca stan bieżący zamiast
--    dokładać drugi ruch.
-- =============================================================================

create or replace function public.koryguj_stan(
  p_produkt uuid,
  p_delta integer,
  p_powod text,
  p_notatka text default null,
  p_klucz uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stan_przed integer;
  stan_po integer;
begin
  if not public.authorize('inventory.write') then
    raise exception 'Brak uprawnień do zmiany stanu magazynowego';
  end if;

  if p_delta = 0 then
    raise exception 'Korekta o zero sztuk nie jest zmianą';
  end if;

  if coalesce(btrim(p_powod), '') = '' then
    raise exception 'Powód korekty jest wymagany';
  end if;

  -- Powtórka rozpoznana po kluczu: oddajemy stan, jaki jest, i wychodzimy.
  -- Sprawdzenie przed blokadą, żeby druga próba nie czekała na pierwszą.
  if p_klucz is not null and exists (
    select 1 from public.inventory_movements where klucz_operacji = p_klucz
  ) then
    select stock into stan_po from public.products where id = p_produkt;
    return stan_po;
  end if;

  select stock into stan_przed
  from public.products
  where id = p_produkt
  for update;

  if stan_przed is null then
    raise exception 'Nie ma produktu o id %', p_produkt;
  end if;

  stan_po := stan_przed + p_delta;

  if stan_po < 0 then
    raise exception 'Na stanie jest % szt., nie można zdjąć %', stan_przed, abs(p_delta)
      using errcode = 'check_violation';
  end if;

  update public.products set stock = stan_po where id = p_produkt;

  insert into public.inventory_movements
    (product_id, delta, reason, notatka, klucz_operacji, created_by)
  values
    (p_produkt, p_delta, btrim(p_powod), nullif(btrim(p_notatka), ''), p_klucz, auth.uid());

  return stan_po;
end;
$$;

-- Funkcja sprawdza uprawnienie sama, więc zostaje wystawiona zalogowanym —
-- tak samo jak `adjust_stock`. Rola PUBLIC traci prawo, które Postgres nadaje
-- każdej nowej funkcji z automatu.
revoke execute on function public.koryguj_stan(uuid, integer, text, text, uuid) from public;
grant execute on function public.koryguj_stan(uuid, integer, text, text, uuid) to authenticated;

-- =============================================================================
-- Nadanie przesyłki
--
-- Zmiana stanu i zapis numeru listu w jednym miejscu: interfejs nie może
-- ustawić „wysłane" bez numeru ani numeru bez zmiany stanu, bo to dwa zapisy,
-- z których drugi może nie dojść.
-- =============================================================================

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
begin
  if not public.authorize('orders.write') then
    raise exception 'Brak uprawnień do zmiany zamówienia';
  end if;

  if coalesce(btrim(p_numer), '') = '' then
    raise exception 'Numer przesyłki jest wymagany';
  end if;

  -- Powtórne nadanie nie nadpisuje numeru: paczka ma jeden list przewozowy,
  -- a drugie dotknięcie przycisku to zwykle ta sama paczka, nie nowa.
  select numer_przesylki into numer from public.orders where id = p_zamowienie for update;

  if numer is not null and btrim(numer) <> '' then
    return numer;
  end if;

  update public.orders
  set numer_przesylki = btrim(p_numer),
      status = 'wysłane'
  where id = p_zamowienie
  returning numer_przesylki into numer;

  if numer is null then
    raise exception 'Nie ma zamówienia o id %', p_zamowienie;
  end if;

  return numer;
end;
$$;

revoke execute on function public.nadaj_przesylke(uuid, text) from public;
grant execute on function public.nadaj_przesylke(uuid, text) to authenticated;

-- =============================================================================
-- Zmiana stanu zamówienia w kolejce pakowania
-- =============================================================================

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

  -- Wysyłkę nadaje `nadaj_przesylke`, razem z numerem listu. Gdyby ten stan
  -- dało się ustawić tędy, paczka mogłaby wyjechać bez numeru.
  if p_stan = 'wysłane' then
    raise exception 'Stan „wysłane" ustawia nadanie przesyłki';
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

revoke execute on function public.ustaw_stan_zamowienia(uuid, order_status) from public;
grant execute on function public.ustaw_stan_zamowienia(uuid, order_status) to authenticated;
