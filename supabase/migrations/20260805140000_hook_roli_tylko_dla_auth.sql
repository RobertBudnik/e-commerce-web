-- =============================================================================
-- Hook roli — odebranie prawa wykonania wszystkim poza usługą Auth
--
-- Na wdrożonym projekcie `custom_access_token_hook(jsonb)` miał EXECUTE dla
-- PUBLIC, `anon` i `authenticated`, mimo że 20260727090300 i 20260801000000
-- to prawo odbierają. Stan sprawdzony zapytaniem:
--
--   select grantee, privilege_type from information_schema.routine_privileges
--   where specific_schema = 'public' and routine_name = 'custom_access_token_hook';
--
--   postgres | service_role | authenticated | anon | PUBLIC
--
-- Na bazie odtworzonej z migracji zostają wyłącznie `postgres`
-- i `supabase_auth_admin`. Różnica bierze się stąd, że funkcję odtworzono na
-- zdalnej bazie poza migracjami — `create function` nadaje EXECUTE roli PUBLIC
-- od nowa, a wcześniejsze `revoke` dotyczyło poprzedniego bytu.
--
-- Czym to grozi: hook przyjmuje `user_id` z wejścia i zwraca claim z rolą.
-- Klucz `anon` jest publiczny z założenia — leży w kodzie strony — więc
-- każdy mógł odpytać `/rest/v1/rpc/custom_access_token_hook` o rolę
-- dowolnego konta.
--
-- UWAGA przy czytaniu tej migracji: na wdrożonym projekcie
-- `supabase_auth_admin` NIE miał własnego wpisu — prawo brał z grantu dla
-- PUBLIC. Samo `revoke ... from public` odcięłoby więc usługę Auth od hooka
-- i logowanie zaczęłoby zwracać 500 „Database error querying schema".
-- Dlatego grant dla Auth idzie tu jawnie i przed odebraniem.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    raise notice 'Brak roli supabase_auth_admin — pomijam granty hooka (środowisko testowe)';
    return;
  end if;

  -- Kolejność ma znaczenie: najpierw jawne prawo dla Auth, potem odebranie
  -- reszcie. Odwrotnie zostawiłoby lukę bez działającego logowania.
  grant usage on schema public to supabase_auth_admin;
  grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
  grant select on table public.user_roles to supabase_auth_admin;
end $$;

-- Poza blokiem warunkowym: odebranie ma się wykonać także tam, gdzie roli
-- supabase_auth_admin nie ma (testy schematu na Postgresie w WASM). Inaczej
-- środowisko testowe nie odpowiada wdrożonemu i luka nie ma jak zostać złapana.
revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;

-- service_role omija RLS i służy funkcjom Edge; hook nie jest im do niczego
-- potrzebny, a każde nadmiarowe prawo na tej roli to szerszy promień rażenia.
revoke execute on function public.custom_access_token_hook(jsonb)
  from service_role;
