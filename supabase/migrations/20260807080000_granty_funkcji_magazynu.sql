-- =============================================================================
-- Odebranie prawa uruchamiania funkcji magazynu rolom, które go nie potrzebują
--
-- Migracja 20260806090100 kończyła się na `revoke execute ... from public`.
-- To za mało na wdrożonym projekcie: Supabase ma ustawione domyślne
-- uprawnienia (`alter default privileges`) nadające EXECUTE rolom `anon`,
-- `authenticated` i `service_role` przy każdej nowej funkcji w schemacie
-- `public`. Grant dla PUBLIC znika, jawne granty zostają.
--
-- Stan zastany po wgraniu, sprawdzony zapytaniem do
-- information_schema.routine_privileges:
--
--   koryguj_stan          anon, authenticated, postgres, service_role
--   nadaj_przesylke       anon, authenticated, postgres, service_role
--   ustaw_stan_zamowienia anon, authenticated, postgres, service_role
--
-- Wykorzystać się tego nie da — każda z tych funkcji sprawdza `authorize()`
-- po swojej stronie i niezalogowanemu odmawia. Ale klucz `anon` jest
-- publiczny z założenia i nie ma powodu, żeby te trzy nazwy w ogóle dawały
-- się wywołać spod niego: każde zbędne prawo to szerszy promień rażenia,
-- gdy kiedyś ktoś doda gałąź kodu przed sprawdzeniem uprawnień.
--
-- `service_role` omija RLS i służy funkcjom Edge. Te trzy funkcje są dla
-- zalogowanego zaplecza, więc tam też nie mają czego szukać.
-- =============================================================================

revoke execute on function public.koryguj_stan(uuid, integer, text, text, uuid)
  from anon, service_role;

revoke execute on function public.nadaj_przesylke(uuid, text)
  from anon, service_role;

revoke execute on function public.ustaw_stan_zamowienia(uuid, order_status)
  from anon, service_role;

-- Zaplecze woła je z sesji użytkownika, więc `authenticated` prawo zachowuje.
grant execute on function public.koryguj_stan(uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.nadaj_przesylke(uuid, text) to authenticated;
grant execute on function public.ustaw_stan_zamowienia(uuid, order_status) to authenticated;
