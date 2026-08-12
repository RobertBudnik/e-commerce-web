-- =============================================================================
-- Nordo — przesyłki
--
-- `orders.numer_przesylki` wystarczał, dopóki paczki nadawało się ręcznie
-- u jednego przewoźnika. Panel wysyłek potrzebuje rzeczy, które w kolumnie
-- tekstowej nie mieszczą się bez sklejania: przewoźnika, punkt odbioru,
-- identyfikator u przewoźnika, status doręczenia i moment jego odczytu.
--
-- Status z zewnątrz bywa spóźniony, więc `status_odczyt` jedzie obok niego.
-- „Doręczono" bez daty odczytu nie mówi, czy to sprzed minuty, czy sprzed
-- trzech dni — a właśnie o to pyta klient przez telefon.
--
-- Jedna droga zapisu: `nadaj_paczke()`. Stare `nadaj_przesylke(uuid, text)`
-- zostaje z niezmienioną sygnaturą i deleguje do niej, bo woła je aplikacja
-- magazynu. Dwie funkcje piszące to samo dwoma sposobami to gwarancja, że
-- któraś z nich kiedyś zapomni o czymś, co robi druga.
-- =============================================================================

create type public.przewoznik as enum ('inpost', 'inny');

create table if not exists public.przesylki (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  przewoznik public.przewoznik not null default 'inny',
  -- Identyfikator u przewoźnika: po nim pobiera się etykietę i status.
  zewnetrzny_id text,
  numer text,
  -- Kod paczkomatu, np. KRA012. Wybrany przez klienta w kasie.
  punkt_odbioru text,
  status text,
  status_odczyt timestamptz,
  utworzona timestamptz not null default now()
);

-- Jedno zamówienie, jedna przesyłka. Przy podziale na paczki zdejmij ten
-- indeks świadomie i przejrzyj wszystkie miejsca, które zakładają jedną.
create unique index if not exists przesylki_zamowienie on public.przesylki (order_id);

comment on table public.przesylki is
  'Przesyłka zamówienia u przewoźnika. Zapis wyłącznie przez nadaj_paczke().';

alter table public.przesylki enable row level security;

-- Klient swojej przesyłki nie czyta stąd — numer i tak widzi przy zamówieniu.
create policy "przesyłki: odczyt zaplecza" on public.przesylki
  for select to authenticated
  using ((select public.authorize('orders.read_all')));

grant select on public.przesylki to authenticated;

-- ---------------------------------------------------------------------------
-- Nadanie paczki
--
-- Idempotentne po zamówieniu: drugie dotknięcie przycisku oddaje istniejący
-- numer, zamiast tworzyć drugą paczkę. Przy wpięciu przewoźnika po API ta
-- własność jest jedyną obroną przed podwójnym nadaniem po timeoucie — dlatego
-- sprawdzenie siedzi w bazie, a nie w interfejsie.
-- ---------------------------------------------------------------------------
create or replace function public.nadaj_paczke(
  p_zamowienie uuid,
  p_numer text,
  p_przewoznik public.przewoznik default 'inny',
  p_punkt text default null,
  p_zewnetrzny_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  numer text;
  stan public.order_status;
  numer_zamowienia text;
begin
  if not public.authorize('orders.write') then
    raise exception 'Brak uprawnień do zmiany zamówienia';
  end if;

  if coalesce(btrim(p_numer), '') = '' then
    raise exception 'Numer przesyłki jest wymagany';
  end if;

  select numer_przesylki, status, order_number
    into numer, stan, numer_zamowienia
  from public.orders where id = p_zamowienie for update;

  if stan is null then
    raise exception 'Nie ma zamówienia o id %', p_zamowienie;
  end if;

  -- Paczka ma jeden list przewozowy. Powtórka to zwykle ta sama paczka.
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

  insert into public.przesylki (order_id, przewoznik, zewnetrzny_id, numer, punkt_odbioru)
  values (p_zamowienie, p_przewoznik, p_zewnetrzny_id, numer, p_punkt)
  on conflict (order_id) do update
    set numer = excluded.numer,
        przewoznik = excluded.przewoznik,
        zewnetrzny_id = coalesce(excluded.zewnetrzny_id, public.przesylki.zewnetrzny_id),
        punkt_odbioru = coalesce(excluded.punkt_odbioru, public.przesylki.punkt_odbioru);

  perform public.zapisz_w_dzienniku(
    'przesylka',
    numer_zamowienia,
    format('nadano przesyłkę %s (%s)', numer, p_przewoznik),
    jsonb_build_object('numer', numer, 'przewoznik', p_przewoznik, 'punkt', p_punkt)
  );

  return numer;
end;
$$;

revoke execute on function public.nadaj_paczke(uuid, text, public.przewoznik, text, text)
  from public, anon, service_role;
grant execute on function public.nadaj_paczke(uuid, text, public.przewoznik, text, text)
  to authenticated;

-- Stara droga zostaje przy życiu, ale przestaje być drugą implementacją.
create or replace function public.nadaj_przesylke(
  p_zamowienie uuid,
  p_numer text
)
returns text
language sql
security definer
set search_path = public
as $$
  select public.nadaj_paczke(p_zamowienie, p_numer, 'inny', null, null);
$$;

revoke execute on function public.nadaj_przesylke(uuid, text) from public, anon, service_role;
grant execute on function public.nadaj_przesylke(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Odczyt statusu od przewoźnika
--
-- Woła to funkcja Edge po webhooku albo po odpytaniu. Status zapisujemy
-- surowy, taki jak przyszedł: mapowanie na trzy rzeczy, które widzi właściciel,
-- robi interfejs. Nowa wartość po stronie przewoźnika ma nie wywracać zapisu.
-- ---------------------------------------------------------------------------
create or replace function public.zapisz_status_przesylki(
  p_zamowienie uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.authorize('orders.write') then
    raise exception 'Brak uprawnień do zmiany przesyłki';
  end if;

  update public.przesylki
  set status = p_status, status_odczyt = now()
  where order_id = p_zamowienie;
end;
$$;

revoke execute on function public.zapisz_status_przesylki(uuid, text)
  from public, anon, service_role;
grant execute on function public.zapisz_status_przesylki(uuid, text) to authenticated;
