-- =============================================================================
-- Kontrola schematu — czy baza nadąża za kodem
--
-- 19.09.2026 produkcja stała siedem migracji za repozytorium. Dwie funkcje,
-- które kod sklepu wołał na każdej ścieżce szukania i przy każdej obniżce,
-- po prostu nie istniały:
--
--   katalog_szukaj         HTTP 404  PGRST202
--   najnizsza_cena_30dni   HTTP 404  PGRST202
--
-- Nic tego nie zgłaszało. Aplikacja wdrażała się sama (Vercel na każdy
-- merge), migracje nie wdrażały się wcale, a rozjazd był widoczny dopiero
-- wtedy, gdy ktoś kliknął w wyszukiwarkę.
--
-- Ta funkcja zamienia niewidzialny rozjazd w liczbę, którą da się odpytać
-- z zewnątrz — czyta ją sonda `/api/zdrowie`.
--
-- Lista jest **ręczna i to jest zamierzone**. Automatyczne wykrywanie „czego
-- używa kod" wymagałoby analizy źródeł w bazie, a to gorsze niż jawny spis:
-- dopisanie funkcji do tej listy przy nowej migracji jest jednym wierszem
-- i zmusza do świadomej decyzji, czy nowa funkcja jest krytyczna dla sklepu,
-- czy tylko wygodna.
-- =============================================================================

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

comment on function public.brakujace_funkcje() is
  'Funkcje wymagane przez kod sklepu, których nie ma w bazie. Pusta tablica = schemat nadąża.';

-- Odczyt publiczny: czyta to sonda zdrowia, którą monitoring musi odpytać
-- bez logowania. Funkcja oddaje wyłącznie nazwy własnych funkcji — nie ma
-- tu niczego, czego nie widać w repozytorium.
grant execute on function public.brakujace_funkcje() to anon, authenticated;
