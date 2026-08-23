-- =============================================================================
-- Nordo — cofnięcie grantów, których nie pokrywa żadna polityka
--
-- UWAGA: ta migracja NIE jest jeszcze nałożona na produkcję. Przed jej
-- wysłaniem przeczytaj sekcję „ryzyko" na końcu pliku.
--
-- Stan zastany na produkcji: role `anon` i `authenticated` miały INSERT, UPDATE
-- i DELETE na **każdej** tabeli schematu public — łącznie z `orders`,
-- `user_roles` i `role_permissions`. W kopii lokalnej nie ma ani jednego
-- takiego grantu, więc rozjazd nie był widoczny w niczym, co robimy na co dzień.
--
-- Skąd się wziął: migracje w tym repozytorium cofają wyłącznie EXECUTE na
-- funkcjach; grantów tabelowych nie rusza żadna. Szerokie prawa to domyślne
-- `alter default privileges` platformy Supabase, które obowiązują na projekcie
-- hostowanym, a w lokalnym stosie nie.
--
-- Czy dało się to wykorzystać: nie. RLS jest włączony na wszystkich tabelach,
-- każda ma politykę, a cztery widoki analityczne mają `security_invoker = true`,
-- więc czytają przez RLS wołającego zamiast omijać zabezpieczenia tabel pod
-- spodem. Grant bez pasującej polityki nie daje nic.
--
-- Po co więc to cofać: bo RLS zostaje wtedy jedyną warstwą. Pomyłka w jednej
-- polityce albo tabela dołożona bez `enable row level security` przestaje być
-- drobnym błędem, a staje się anonimowym zapisem do zamówień i ról.
--
-- Reguła doboru — wyprowadzona z bazy, nie z oka:
--
--   grant zostaje wyłącznie tam, gdzie istnieje polityka dla tej samej komendy
--   i tej samej roli; bez polityki operacja i tak jest odmawiana
--
-- Dlatego to cofnięcie nie może niczego zepsuć: kasuje prawa, z których nikt
-- nie mógł skorzystać. Sprawdzone osobno dla ścieżek, które piszą do tabel
-- wprost (products, product_images, categories, koszty_produktow, wishlists,
-- addresses, profiles) — wszystkie działają jako zalogowany i mają politykę,
-- więc tracą prawa tylko po stronie `anon`.
--
-- Zakup bez konta nie potrzebuje grantów tabelowych: idzie przez `quote_order`
-- i `create_order`, funkcje SECURITY DEFINER wystawione gościom świadomie.
--
-- Widoki (marza_dziennie, sprzedaz_dziennie, sprzedaz_produktow,
-- zainteresowanie_produktow) nie mają RLS, więc nie mają i polityk. Traktowane
-- osobno: `anon` traci wszystko, `authenticated` zachowuje SELECT — czyta je
-- panel finansów przez lib/queries.ts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Nadmiar dla roli anon
-- ---------------------------------------------------------------------------
revoke DELETE on public.coupons from anon;
revoke INSERT on public.coupons from anon;
revoke SELECT on public.coupons from anon;
revoke UPDATE on public.coupons from anon;
revoke DELETE on public.dziennik_zaplecza from anon;
revoke INSERT on public.dziennik_zaplecza from anon;
revoke SELECT on public.dziennik_zaplecza from anon;
revoke UPDATE on public.dziennik_zaplecza from anon;
revoke DELETE on public.historia_cen from anon;
revoke INSERT on public.historia_cen from anon;
revoke UPDATE on public.historia_cen from anon;
revoke DELETE on public.inventory_movements from anon;
revoke INSERT on public.inventory_movements from anon;
revoke SELECT on public.inventory_movements from anon;
revoke UPDATE on public.inventory_movements from anon;
revoke DELETE on public.koszty_pozycji from anon;
revoke INSERT on public.koszty_pozycji from anon;
revoke SELECT on public.koszty_pozycji from anon;
revoke UPDATE on public.koszty_pozycji from anon;
revoke DELETE on public.koszty_produktow from anon;
revoke INSERT on public.koszty_produktow from anon;
revoke SELECT on public.koszty_produktow from anon;
revoke UPDATE on public.koszty_produktow from anon;
revoke DELETE on public.marza_dziennie from anon;
revoke INSERT on public.marza_dziennie from anon;
revoke SELECT on public.marza_dziennie from anon;
revoke UPDATE on public.marza_dziennie from anon;
revoke DELETE on public.orders from anon;
revoke INSERT on public.orders from anon;
revoke UPDATE on public.orders from anon;
revoke DELETE on public.product_images from anon;
revoke INSERT on public.product_images from anon;
revoke UPDATE on public.product_images from anon;
revoke DELETE on public.products from anon;
revoke INSERT on public.products from anon;
revoke UPDATE on public.products from anon;
revoke DELETE on public.profiles from anon;
revoke INSERT on public.profiles from anon;
revoke DELETE on public.przesylki from anon;
revoke INSERT on public.przesylki from anon;
revoke SELECT on public.przesylki from anon;
revoke UPDATE on public.przesylki from anon;
revoke INSERT on public.reviews from anon;
revoke DELETE on public.role_permissions from anon;
revoke INSERT on public.role_permissions from anon;
revoke SELECT on public.role_permissions from anon;
revoke UPDATE on public.role_permissions from anon;
revoke DELETE on public.shop_events from anon;
revoke SELECT on public.shop_events from anon;
revoke UPDATE on public.shop_events from anon;
revoke DELETE on public.sprzedaz_dziennie from anon;
revoke INSERT on public.sprzedaz_dziennie from anon;
revoke SELECT on public.sprzedaz_dziennie from anon;
revoke UPDATE on public.sprzedaz_dziennie from anon;
revoke DELETE on public.sprzedaz_produktow from anon;
revoke INSERT on public.sprzedaz_produktow from anon;
revoke SELECT on public.sprzedaz_produktow from anon;
revoke UPDATE on public.sprzedaz_produktow from anon;
revoke DELETE on public.store_settings from anon;
revoke INSERT on public.store_settings from anon;
revoke UPDATE on public.store_settings from anon;
revoke DELETE on public.user_roles from anon;
revoke INSERT on public.user_roles from anon;
revoke UPDATE on public.user_roles from anon;
revoke DELETE on public.zainteresowanie_produktow from anon;
revoke INSERT on public.zainteresowanie_produktow from anon;
revoke SELECT on public.zainteresowanie_produktow from anon;
revoke UPDATE on public.zainteresowanie_produktow from anon;
revoke DELETE on public.zwroty from anon;
revoke UPDATE on public.zwroty from anon;
revoke DELETE on public.zwroty_pozycje from anon;
revoke UPDATE on public.zwroty_pozycje from anon;

-- ---------------------------------------------------------------------------
-- Nadmiar dla roli authenticated
-- ---------------------------------------------------------------------------
revoke DELETE on public.dziennik_zaplecza from authenticated;
revoke INSERT on public.dziennik_zaplecza from authenticated;
revoke UPDATE on public.dziennik_zaplecza from authenticated;
revoke DELETE on public.historia_cen from authenticated;
revoke INSERT on public.historia_cen from authenticated;
revoke UPDATE on public.historia_cen from authenticated;
revoke DELETE on public.inventory_movements from authenticated;
revoke INSERT on public.inventory_movements from authenticated;
revoke UPDATE on public.inventory_movements from authenticated;
revoke DELETE on public.koszty_pozycji from authenticated;
revoke INSERT on public.koszty_pozycji from authenticated;
revoke UPDATE on public.koszty_pozycji from authenticated;
revoke DELETE on public.marza_dziennie from authenticated;
revoke INSERT on public.marza_dziennie from authenticated;
revoke UPDATE on public.marza_dziennie from authenticated;
revoke DELETE on public.orders from authenticated;
revoke INSERT on public.orders from authenticated;
revoke DELETE on public.profiles from authenticated;
revoke INSERT on public.profiles from authenticated;
revoke DELETE on public.przesylki from authenticated;
revoke INSERT on public.przesylki from authenticated;
revoke UPDATE on public.przesylki from authenticated;
revoke INSERT on public.reviews from authenticated;
revoke DELETE on public.role_permissions from authenticated;
revoke INSERT on public.role_permissions from authenticated;
revoke UPDATE on public.role_permissions from authenticated;
revoke DELETE on public.shop_events from authenticated;
revoke UPDATE on public.shop_events from authenticated;
revoke DELETE on public.sprzedaz_dziennie from authenticated;
revoke INSERT on public.sprzedaz_dziennie from authenticated;
revoke UPDATE on public.sprzedaz_dziennie from authenticated;
revoke DELETE on public.sprzedaz_produktow from authenticated;
revoke INSERT on public.sprzedaz_produktow from authenticated;
revoke UPDATE on public.sprzedaz_produktow from authenticated;
revoke DELETE on public.store_settings from authenticated;
revoke INSERT on public.store_settings from authenticated;
revoke DELETE on public.zainteresowanie_produktow from authenticated;
revoke INSERT on public.zainteresowanie_produktow from authenticated;
revoke UPDATE on public.zainteresowanie_produktow from authenticated;
revoke DELETE on public.zwroty from authenticated;
revoke DELETE on public.zwroty_pozycje from authenticated;
revoke UPDATE on public.zwroty_pozycje from authenticated;

-- ---------------------------------------------------------------------------
-- Żeby to nie wróciło przy następnej tabeli
--
-- Bez tego każda nowa tabela dostanie od platformy komplet praw dla `anon`
-- i `authenticated`, a rozjazd odtworzy się sam.
--
-- Cena: od tej chwili nowa tabela nie ma grantów, dopóki ktoś ich jawnie nie
-- nada. To jest zamierzone — nadanie prawa ma być decyzją, nie domyślnym
-- zachowaniem — ale trzeba o tym pamiętać, bo objawia się jako „PostgREST
-- nie widzi mojej tabeli".
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- =============================================================================
-- RYZYKO PRZED NAŁOŻENIEM
--
-- 1. Lista powstała z odczytu produkcji, nie z kopii lokalnej. Jeśli produkcja
--    zmieni się przed nałożeniem, przelicz ją ponownie tym samym zapytaniem.
-- 2. `db diff` nie widzi grantów. Po nałożeniu sprawdź stan osobnym zapytaniem
--    o `information_schema.role_table_grants`, a nie samym „Finished".
-- 3. Sprawdź po nałożeniu, czy działa: katalog dla gościa, zakup bez konta,
--    panel finansów i katalogu, konto klienta z adresami i listą życzeń.
-- =============================================================================
