-- =============================================================================
-- Nordo — bezpieczeństwo ścieżki płatności
--
-- Pięć dziur w drodze pieniędzy, każda potwierdzona na żywej bazie sondą,
-- nie z lektury kodu. Wszystkie leżą po stronie webhooka operatora, czyli
-- w jedynym miejscu, które ma prawo uznać zamówienie za opłacone.
--
-- 1. WEBHOOK NIE UMIE ANULOWAĆ. `cancel_order()` sprawdza
--    `authorize('orders.write')`, ta woła `current_role_name()`, a ta zwraca
--    null, gdy `auth.uid()` jest null. Klucz `service_role` nie niesie
--    użytkownika, więc auth.uid() jest null zawsze. Sonda na produkcji:
--
--      SONDA[cancel_order ODRZUCONY: Brak uprawnień do anulowania tego zamówienia]
--
--    Skutek łańcuchowy: `checkout.session.expired` → wyjątek → webhook oddaje
--    500 → operator ponawia z narastającym odstępem i po dobie odpuszcza →
--    zarezerwowany towar NIGDY nie wraca na magazyn. Przy nakładzie liczonym
--    w sztukach jedna porzucona kasa wyłącza produkt ze sprzedaży na stałe.
--
-- 2. NIE MA ŚLADU PRZETWORZONYCH ZDARZEŃ. `mark_order_paid()` jest
--    idempotentne względem stanu zamówienia i to wystarcza przy powtórce tego
--    samego zdarzenia. Nie wystarcza, gdy operator dośle zdarzenia w innej
--    kolejności ani gdy dojdzie zwrot: nie wiadomo, które `evt_...` już
--    przeszły.
--
-- 3. ZWROT PIENIĘDZY NIE WRACA DO BAZY. Zwrot zrobiony w panelu operatora nie
--    dociera nigdzie, a zamówienie zostaje „opłacone" na zawsze. Księgowo to
--    jest przychód, którego nie ma.
--
-- 4. KWOTA NIE JEST SPRAWDZANA PRZY OZNACZANIU WPŁATY. `mark_order_paid()`
--    wierzy wołającemu na słowo. Baza jest ostatnią linią i ma prawo odmówić,
--    gdy wpłata nie zgadza się z rachunkiem.
--
-- 5. LIMIT SKŁADANIA ZAMÓWIEŃ DA SIĘ OMINĄĆ. Zapora z `create-checkout` liczy
--    próby w funkcji brzegowej, ale `create_order` jest wystawione gościom pod
--    `/rest/v1/rpc/create_order` i klucz `anon` leży w kodzie strony. Sesji
--    płatności tą drogą nie da się założyć, więc testowanie kart dalej jest
--    zamknięte — ale zdejmowanie stanu magazynowego już nie.
--
-- Wspólny mianownik z migracją 20260807160000: ograniczenie, które istnieje
-- wyłącznie w jednej warstwie, nie jest ograniczeniem. Tam było w interfejsie,
-- tu w funkcji brzegowej.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Ślad zdarzeń operatora
-- ---------------------------------------------------------------------------
-- Dlaczego dwa stany, a nie samo „widziałem to id":
--
-- Wpis PRZED obsługą daje „co najwyżej raz" — gdy funkcja padnie w połowie,
-- ponowienie zobaczy wpis i grzecznie odpuści zdarzenie, które nigdy nie
-- zostało obsłużone. Przy płatności to najgorszy możliwy wybór.
--
-- Wpis PO obsłudze daje „co najmniej raz", ale wtedy tabela nie chroni przed
-- niczym w trakcie.
--
-- Stąd znacznik zajęcia: wiersz powstaje na wejściu ze stanem `w_toku`
-- i dopiero udana obsługa przestawia go na `zrobione`. Powtórka zdarzenia
-- `zrobione` odpada bez ruszania zamówienia, a powtórka po padzie (`w_toku`)
-- zostaje obsłużona jeszcze raz. Wszystkie operacje pod spodem są
-- idempotentne, więc drugie przejście niczego nie psuje.
create table if not exists public.platnosci_zdarzenia (
  event_id text primary key,               -- evt_... nadane przez operatora
  typ text not null,                       -- checkout.session.completed itd.
  order_id uuid references public.orders (id) on delete set null,
  -- Tryb, w którym zdarzenie powstało. Trzymany, bo pomyłka „endpoint testowy
  -- wpięty w produkcję" wygląda w bazie dokładnie jak prawdziwa sprzedaż,
  -- tylko pieniędzy nie ma.
  livemode boolean,
  stan text not null default 'w_toku' check (stan in ('w_toku', 'zrobione')),
  odebrane_at timestamptz not null default now(),
  zrobione_at timestamptz
);

alter table public.platnosci_zdarzenia enable row level security;

-- Bez polityk i to jest zamierzone: RLS jest włączone, więc bez polityki nikt
-- nie sięgnie tu z przeglądarki. Pisze wyłącznie webhook kluczem service_role,
-- który RLS omija. Odczyt dla zaplecza dopiszemy, gdy powstanie ekran historii
-- płatności — dziś nie ma go po co otwierać.

comment on table public.platnosci_zdarzenia is
  'Zdarzenia operatora płatności przepuszczone przez webhook. Chroni przed powtórką i zapisuje kolejność.';

-- Zapytanie „co przyszło dla tego zamówienia" pada przy każdej reklamacji.
create index if not exists platnosci_zdarzenia_order_idx
  on public.platnosci_zdarzenia (order_id, odebrane_at desc);


-- ---------------------------------------------------------------------------
-- Zajęcie zdarzenia: true = obsługuj, false = to już przeszło
-- ---------------------------------------------------------------------------
create or replace function public.zdarzenie_platnosci_zajmij(
  p_event_id text,
  p_typ text,
  p_order_id uuid default null,
  p_livemode boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stan text;
  v_order uuid;
begin
  if coalesce(btrim(p_event_id), '') = '' then
    -- Zdarzenie bez identyfikatora nie jest zdarzeniem operatora. Lepiej
    -- odmówić głośno niż przepuścić coś, czego nie da się potem odtworzyć.
    raise exception 'Zdarzenie płatności bez identyfikatora';
  end if;

  -- Zamówienie spoza tej bazy (zdarzenie z drugiego trybu operatora, sesja
  -- z innego wdrożenia) nie ma prawa wywrócić zapisu o klucz obcy. Ślad
  -- zdarzenia powstaje bez wskazania na zamówienie — samo zdarzenie i tak
  -- odpadnie niżej, ale odpadnie RAZ, zamiast wracać w nieskończoność.
  select id into v_order from public.orders where id = p_order_id;

  insert into public.platnosci_zdarzenia (event_id, typ, order_id, livemode)
  values (btrim(p_event_id), p_typ, v_order, p_livemode)
  on conflict (event_id) do nothing;

  if found then
    return true;
  end if;

  select stan into v_stan
  from public.platnosci_zdarzenia
  where event_id = btrim(p_event_id);

  -- Poprzednie podejście padło przed zamknięciem — obsługujemy jeszcze raz.
  return v_stan = 'w_toku';
end;
$$;

comment on function public.zdarzenie_platnosci_zajmij(text, text, uuid, boolean) is
  'true = to zdarzenie trzeba obsłużyć. false = zostało już domknięte wcześniej.';

create or replace function public.zdarzenie_platnosci_zamknij(p_event_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.platnosci_zdarzenia
  set stan = 'zrobione', zrobione_at = now()
  where event_id = btrim(p_event_id);
$$;

-- Obie wyłącznie dla webhooka. Klient sklepu mógłby nimi uciszyć cudze
-- zdarzenie płatności, zanim dojdzie do zamówienia.
--
-- Nadanie dla `service_role` jest tu JAWNE, choć platforma nadaje je sama
-- domyślnymi uprawnieniami na nowych funkcjach. Poleganie na tym oznacza, że
-- prawo do wołania webhooka bierze się z ustawienia, którego nie ma
-- w repozytorium i którego nie widać w `db diff` — dokładnie ta klasa
-- rozjazdu, przez którą trzeba było czytać granty produkcji osobnym
-- zapytaniem. Testy schematu sprawdzają te nadania po nazwie.
revoke all on function public.zdarzenie_platnosci_zajmij(text, text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.zdarzenie_platnosci_zamknij(text)
  from public, anon, authenticated;

grant execute on function public.zdarzenie_platnosci_zajmij(text, text, uuid, boolean)
  to service_role;
grant execute on function public.zdarzenie_platnosci_zamknij(text)
  to service_role;


-- ---------------------------------------------------------------------------
-- 2. Anulowanie wołane przez webhook
-- ---------------------------------------------------------------------------
-- Osobna funkcja zamiast rozluźnienia `cancel_order()`. Kuszące byłoby
-- dopisanie tam „albo service_role", ale `cancel_order` jest wystawione
-- zalogowanym i każde rozluźnienie w niej dotyka ścieżki klienta. Ta funkcja
-- nie jest wystawiona nikomu poza webhookiem, więc jej granice da się ustawić
-- pod jeden konkretny przypadek: sesja płatności skończyła się niczym.
--
-- Czego ta funkcja NIE robi i nie ma robić: nie anuluje zamówienia
-- opłaconego. Zdarzenie o wygaśnięciu sesji potrafi dojść po potwierdzeniu
-- wpłaty (kolejność zdarzeń u operatora nie jest gwarantowana), a anulowanie
-- opłaconego zamówienia znaczy tyle, co oddanie towaru na magazyn przy
-- pieniądzach leżących na koncie. Zwrot pieniędzy jest decyzją człowieka.
create or replace function public.anuluj_sesje_platnosci(
  p_order_id uuid,
  p_platnosc public.payment_status default null
)
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

  -- Zamówienia nie ma — oddajemy pusty wiersz zamiast wyjątku. Wyjątek
  -- oznaczałby dla webhooka usterkę do ponowienia, a zamówienie, którego tu
  -- nie ma, nie pojawi się przy dziesiątej próbie. Webhook rozpozna null
  -- i odnotuje odmowę na trwałe.
  if target.id is null then
    return null;
  end if;

  -- Opłacone zostaje nietknięte. Zwracamy wiersz zamiast wyjątku, żeby
  -- webhook mógł domknąć zdarzenie i nie zapętlić operatora ponowieniami.
  if target.payment_status = 'opłacone' then
    return target;
  end if;

  if target.status = 'anulowane' then
    return target;
  end if;

  for line in select * from public.order_items where order_id = p_order_id loop
    if line.product_id is not null then
      perform public.return_stock(line.product_id, line.qty, 'wygasła sesja płatności', p_order_id);
    end if;
  end loop;

  -- Ten sam znacznik, co w cancel_order: wyzwalacz `pilnuj_anulowania`
  -- przepuszcza stan „anulowane" wyłącznie wtedy, gdy towar właśnie wrócił.
  perform set_config('nordo.anulowanie', 'on', true);

  update public.orders
  set status = 'anulowane',
      payment_status = coalesce(p_platnosc, payment_status)
  where id = p_order_id
  returning * into target;

  perform set_config('nordo.anulowanie', 'off', true);

  return target;
end;
$$;

comment on function public.anuluj_sesje_platnosci(uuid, public.payment_status) is
  'Anulowanie zamówienia po wygaśnięciu lub odrzuceniu płatności. Wyłącznie dla webhooka operatora.';

revoke all on function public.anuluj_sesje_platnosci(uuid, public.payment_status)
  from public, anon, authenticated;

grant execute on function public.anuluj_sesje_platnosci(uuid, public.payment_status)
  to service_role;


-- ---------------------------------------------------------------------------
-- 3. Zwrot pieniędzy z panelu operatora
-- ---------------------------------------------------------------------------
-- Zdarzenie `charge.refunded` nie niesie metadanych zamówienia — niesie
-- identyfikator wpłaty. Stąd wyszukiwanie po `payment_intent_id`, na którym
-- stoi unikalny indeks częściowy z migracji init.
--
-- Zwrot częściowy NIE przestawia stanu na „zwrócone": zamówienie, z którego
-- oddano jedną pozycję z trzech, dalej jest opłacone. Rozróżnienie idzie
-- z kwot, bo operator wysyła to samo zdarzenie w obu przypadkach.
create or replace function public.oznacz_zwrot_platnosci(
  p_payment_intent text,
  p_zwrocone_groszy integer,
  p_calosc_groszy integer
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders;
begin
  if coalesce(btrim(p_payment_intent), '') = '' then
    raise exception 'Zwrot bez identyfikatora wpłaty';
  end if;

  select * into target
  from public.orders
  where payment_intent_id = btrim(p_payment_intent);

  if target.id is null then
    -- Zwrot wpłaty, której nie znamy. Dzieje się przy zamówieniu złożonym
    -- przed wdrożeniem albo w drugim trybie operatora. Cisza byłaby gorsza:
    -- webhook ma to zobaczyć i zapisać w dzienniku.
    raise exception 'Nie ma zamówienia o wpłacie %', p_payment_intent;
  end if;

  -- Częściowy zwrot zostawia zamówienie opłacone. Odnotowanie kwot jest
  -- robotą księgowości, nie tej kolumny.
  if p_zwrocone_groszy is null
     or p_calosc_groszy is null
     or p_zwrocone_groszy < p_calosc_groszy then
    return target;
  end if;

  update public.orders
  set payment_status = 'zwrócone'
  where id = target.id
    and payment_status <> 'zwrócone'
  returning * into target;

  if target.id is null then
    select * into target from public.orders where payment_intent_id = btrim(p_payment_intent);
  end if;

  return target;
end;
$$;

comment on function public.oznacz_zwrot_platnosci(text, integer, integer) is
  'Pełny zwrot u operatora przestawia payment_status na zwrócone. Częściowy zostawia opłacone.';

revoke all on function public.oznacz_zwrot_platnosci(text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.oznacz_zwrot_platnosci(text, integer, integer)
  to service_role;


-- ---------------------------------------------------------------------------
-- 4. Kwota sprawdzana przy oznaczaniu wpłaty
-- ---------------------------------------------------------------------------
-- Webhook porównuje `amount_total` z rachunkiem, zanim tu zawoła, i to jest
-- właściwe miejsce na pierwsze sprawdzenie. To jest drugie. Powód: `orders`
-- to jedyne miejsce, z którego zaplecze czyta „zapłacone", a funkcja
-- SECURITY DEFINER wołana kluczem `service_role` jest dokładnie tą granicą,
-- za którą nie ma już żadnej kontroli.
--
-- Parametr jest opcjonalny, żeby nie zamykać drogi obsłudze, która oznacza
-- wpłatę ręcznie po przelewie na konto — tam kwotę widział człowiek.
-- Stara sygnatura znika, inaczej pod /rest/v1/rpc zostałoby wejście bez
-- sprawdzenia kwoty.
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_provider text,
  p_payment_intent text,
  p_kwota_groszy integer default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.orders;
  oczekiwana integer;
begin
  select total_cents into oczekiwana from public.orders where id = p_order_id;

  if oczekiwana is null then
    raise exception 'Nie ma zamówienia %', p_order_id;
  end if;

  if p_kwota_groszy is not null and p_kwota_groszy <> oczekiwana then
    raise exception 'Wpłata % gr nie zgadza się z rachunkiem % gr dla zamówienia %',
      p_kwota_groszy, oczekiwana, p_order_id;
  end if;

  update public.orders
  set payment_status = 'opłacone',
      status = case when status = 'nowe' then 'w realizacji' else status end,
      payment_provider = p_provider,
      payment_intent_id = p_payment_intent
  where id = p_order_id
    and payment_status <> 'opłacone'
  returning * into updated;

  -- Powtórka tego samego zdarzenia trafia tutaj: UPDATE nic nie złapał,
  -- bo zamówienie już jest opłacone. Oddajemy bieżący wiersz.
  if updated.id is null then
    select * into updated from public.orders where id = p_order_id;
  end if;

  return updated;
end;
$$;

drop function if exists public.mark_order_paid(uuid, text, text);

revoke all on function public.mark_order_paid(uuid, text, text, integer)
  from public, anon, authenticated;

grant execute on function public.mark_order_paid(uuid, text, text, integer)
  to service_role;


-- ---------------------------------------------------------------------------
-- 5. Limit składania zamówień po stronie bazy
-- ---------------------------------------------------------------------------
-- Zapora z `create-checkout` zostaje bez zmian — liczy po adresie IP, czego
-- w bazie nie widać. Ta warstwa dokłada to, czego tamta nie obejmie: wywołanie
-- `create_order` wprost przez PostgREST, z pominięciem funkcji brzegowej.
--
-- Wyzwalacz zamiast dopisku w `create_order`: przechwytuje KAŻDĄ drogę do
-- tabeli, także surowy INSERT, a nie wymaga przepisywania stu siedemdziesięciu
-- linii funkcji, w których łatwo zgubić po drodze blokadę wierszy.
--
-- Osobny rodzaj `zamowienie`, nie `kasa`: gdyby oba liczyły się do jednego
-- okna, każde zamówienie przez kasę zjadałoby dwa miejsca z pięciu i prawdziwy
-- klient z trzema zamówieniami w godzinę zostałby odbity.
alter table public.limity_poczty drop constraint if exists limity_poczty_rodzaj_check;

alter table public.limity_poczty
  add constraint limity_poczty_rodzaj_check
  check (rodzaj in ('rejestracja', 'reset', 'magic', 'ponowna', 'kasa', 'zamowienie'));

comment on table public.limity_poczty is
  'Okno przesuwne prób: wysyłki poczty, tworzenia sesji płatności (kasa) i składania zamówień (zamowienie). '
  'Klucz to adres IP albo skrót SHA-256 adresu e-mail.';

create or replace function public.limit_skladania_zamowien()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rola text;
begin
  rola := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';

  -- Limit dotyczy wyłącznie ruchu z przeglądarki. `service_role` to webhook
  -- i funkcje brzegowe, brak roli to seed i migracje — jedno i drugie ma
  -- prawo wstawiać zamówienia hurtem.
  if rola is null or rola not in ('anon', 'authenticated') then
    return new;
  end if;

  if coalesce(btrim(new.email), '') = '' then
    return new;
  end if;

  -- Zaplecze bez limitu. Dziś zamówienia składa wyłącznie kasa, ale kiedy
  -- powstanie ekran „zamówienie z telefonu", obsługa wpisująca dziesięć
  -- sztuk pod jeden adres firmowy nie ma się odbijać od zapory na klientów.
  -- Konto z rolą i tak może więcej (korekta stanu), więc to nie poszerza
  -- niczego, co nie było już otwarte.
  if coalesce(public.is_staff(), false) then
    return new;
  end if;

  -- Dziesięć na godzinę na adres. Próg jest luźny wobec prawdziwego klienta
  -- (nikt nie składa dziesięciu zamówień w godzinę) i ciasny wobec skryptu,
  -- który zdejmuje stan magazynowy w pętli.
  if not public.limit_poczty(
       'email:' || public.skrot_adresu(new.email),
       'zamowienie',
       10,
       3600
     ) then
    raise exception 'Za dużo zamówień z tego adresu. Spróbuj za godzinę.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_limit_skladania on public.orders;

create trigger orders_limit_skladania
  before insert on public.orders
  for each row
  execute function public.limit_skladania_zamowien();

revoke all on function public.limit_skladania_zamowien() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. Nowe funkcje w kontroli schematu
-- ---------------------------------------------------------------------------
-- Bez tego wpisu sonda `/api/zdrowie` przepuści produkcję, na której webhook
-- woła funkcje nieistniejące w bazie — czyli dokładnie stan z 19.09.2026,
-- dla którego ta kontrola powstała.
create or replace function public.brakujace_funkcje()
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(w.nazwa order by w.nazwa), array[]::text[])
  from (
    values
      -- Ścieżka zakupu — bez tych sklep nie sprzedaje.
      ('create_order'),
      ('quote_order'),
      ('mark_order_paid'),
      ('cancel_order'),
      ('take_stock'),
      -- Webhook operatora płatności.
      ('zdarzenie_platnosci_zajmij'),
      ('zdarzenie_platnosci_zamknij'),
      ('anuluj_sesje_platnosci'),
      ('oznacz_zwrot_platnosci'),
      -- Katalog i zgodność z prawem.
      ('katalog_szukaj'),
      ('najnizsza_cena_30dni'),
      -- Poczta i robota w tle.
      ('zajmij_mail_zamowienia'),
      ('dodaj_zadanie'),
      ('wez_zadania'),
      ('zamknij_zadanie'),
      -- Limity i uprawnienia.
      ('limit_poczty'),
      ('skrot_adresu'),
      ('authorize')
  ) as w(nazwa)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = w.nazwa
  );
$$;

grant execute on function public.brakujace_funkcje() to anon, authenticated;
