-- =============================================================================
-- Nordo — nadawanie ról z panelu
--
-- Dotąd rolę nadawało się wyłącznie w bazie. Właściciel, który zatrudnia dwie
-- osoby do pakowania, musiał wołać o pomoc przy każdym `insert into user_roles`.
--
-- Tabela `user_roles` ma politykę zapisu dla `roles.manage`, więc technicznie
-- da się pisać do niej wprost z aplikacji. Nie tędy: polityka odpowiada na
-- pytanie „czy wolno pisać", a nie „czy ten konkretny zapis nie zamyka
-- właścicielowi drzwi do własnego sklepu". Trzy reguły niżej dają się wyrazić
-- tylko w funkcji.
-- =============================================================================

create or replace function public.nadaj_role(p_user uuid, p_rola public.app_role)
returns public.app_role
language plpgsql
security definer
set search_path = public
as $$
declare
  moja public.app_role;
  wlascicieli integer;
  byla public.app_role;
  komu text;
begin
  if not public.authorize('roles.manage') then
    raise exception 'Brak uprawnień do zmiany ról';
  end if;

  moja := public.current_role_name();

  select role into byla from public.user_roles where user_id = p_user limit 1;
  select email into komu from public.profiles where id = p_user;

  if komu is null then
    raise exception 'Nie ma takiego konta';
  end if;

  -- 1. Nikt nie nadaje roli wyższej niż własna. Bez tego zarządca z prawem
  --    do ról robi sobie właściciela jednym żądaniem.
  if p_rola = 'owner' and moja <> 'owner' then
    raise exception 'Rolę właściciela nadaje wyłącznie właściciel';
  end if;

  -- 2. Ostatni właściciel zostaje właścicielem. Sklep bez `owner` nie jest do
  --    odzyskania z interfejsu — zostaje SQL na produkcji.
  if byla = 'owner' and p_rola <> 'owner' then
    select count(*) into wlascicieli from public.user_roles where role = 'owner';
    if wlascicieli <= 1 then
      raise exception 'To jedyny właściciel — najpierw nadaj tę rolę komuś innemu';
    end if;
  end if;

  -- 3. Konto ma dokładnie jedną rolę. Dwa wiersze znaczyłyby, że uprawnienia
  --    zależą od kolejności odczytu.
  delete from public.user_roles where user_id = p_user;
  insert into public.user_roles (user_id, role) values (p_user, p_rola);

  if byla is distinct from p_rola then
    perform public.zapisz_w_dzienniku(
      'rola',
      komu,
      format('rola: %s → %s', coalesce(byla::text, 'brak'), p_rola),
      jsonb_build_object('przed', byla, 'po', p_rola)
    );
  end if;

  return p_rola;
end;
$$;

comment on function public.nadaj_role(uuid, public.app_role) is
  'Zmiana roli konta. Broni ostatniego właściciela i zakazu awansu ponad własną rolę.';

revoke execute on function public.nadaj_role(uuid, public.app_role)
  from public, anon, service_role;
grant execute on function public.nadaj_role(uuid, public.app_role) to authenticated;
