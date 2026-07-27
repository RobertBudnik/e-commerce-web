-- =============================================================================
-- Uprawnienia dla hooka custom_access_token
--
-- GoTrue (usługa Auth) łączy się do bazy jako `supabase_auth_admin` i to ona
-- wykonuje hook przy wydawaniu tokenu. Bez poniższych grantów logowanie kończy
-- się błędem 500 "Database error querying schema" — usługa nie widzi ani funkcji,
-- ani tabeli user_roles.
--
-- Rola supabase_auth_admin istnieje wyłącznie w prawdziwym Supabase, dlatego
-- całość jest w bloku warunkowym: testy na gołym Postgresie dalej przechodzą.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    raise notice 'Brak roli supabase_auth_admin — pomijam granty hooka (środowisko testowe)';
    return;
  end if;

  grant usage on schema public to supabase_auth_admin;

  grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

  -- Hook czyta role użytkownika; bez SELECT-a zwróciłby pusty claim
  grant select on table public.user_roles to supabase_auth_admin;

  -- Funkcja nie jest SECURITY DEFINER, więc obowiązuje ją RLS na user_roles.
  -- Polityka dla samej usługi Auth, nie dla użytkowników.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'auth admin czyta role'
  ) then
    create policy "auth admin czyta role" on public.user_roles
      as permissive for select to supabase_auth_admin using (true);
  end if;

  -- Hooka wykonuje wyłącznie Auth — nikt z przeglądarki nie ma prawa go wołać
  revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
end $$;
