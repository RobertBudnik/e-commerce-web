-- =============================================================================
-- Nordo — usunięcie konta klienta z anonimizacją zamówień
--
-- Stan zastany: ścieżki usunięcia konta nie było w ogóle. Jedyną drogą było
-- ręczne skasowanie użytkownika w panelu Supabase — a i to nie usuwało danych
-- osobowych, tylko rozrywało powiązanie:
--
--   orders.user_id           → SET NULL
--   orders.email             → zostaje
--   orders.phone             → zostaje
--   orders.shipping_address  → zostaje
--
-- Czyli klient tracił dostęp do własnych zamówień (RLS dopasowuje po
-- `user_id`), a jego dane kontaktowe i adres zostawały w bazie w komplecie.
-- Najgorszy z możliwych układów: obowiązek z art. 17 niespełniony, a klient
-- ukarany utratą wglądu we własne zakupy.
--
-- Czego NIE wolno zrobić: skasować zamówień. To dokument księgowy —
-- przechowywanie wynika z obowiązku prawnego, który jest samodzielną podstawą
-- przetwarzania i nie ustępuje przed żądaniem usunięcia. Usuwamy więc dane
-- osobowe z zamówienia, zostawiając jego treść ekonomiczną: pozycje, kwoty,
-- daty, stan.
--
-- Co zostaje po anonimizacji: numer zamówienia, pozycje, kwoty, stan płatności
-- i wysyłki. Czego nie ma: adresu e-mail, telefonu, imienia, nazwiska i adresu
-- dostawy.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Najpierw klucz, który blokował kasowanie kont
--
-- Ze wszystkich 19 kluczy obcych wskazujących na `auth.users` dokładnie jeden
-- miał ON DELETE NO ACTION. Skutek: magazynier, który przyjął choćby jeden
-- zwrot, był nieusuwalny — próba kończyła się błędem klucza obcego. Reszta
-- schematu trzyma się tu jednej konwencji (`dziennik_zaplecza.kto`,
-- `inventory_movements.created_by`), więc to było przeoczenie, nie decyzja.
-- ---------------------------------------------------------------------------
alter table public.zwroty
  drop constraint if exists zwroty_przyjety_by_fkey;

alter table public.zwroty
  add constraint zwroty_przyjety_by_fkey
  foreign key (przyjety_by) references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- usun_moje_konto()
--
-- SECURITY DEFINER, bo kasowanie wiersza w `auth.users` jest poza zasięgiem
-- roli `authenticated`. Funkcja działa wyłącznie na koncie wywołującego —
-- `auth.uid()` nie jest parametrem i nie da się go podstawić.
--
-- Kolejność ma znaczenie: najpierw anonimizacja zamówień (dopóki jeszcze
-- widzimy powiązanie po `user_id`), potem dane własne konta, na końcu sam
-- użytkownik. Odwrotna kolejność zerwałaby `user_id` kaskadą i zostawiła
-- zamówienia z danymi, których nie umielibyśmy już znaleźć.
-- ---------------------------------------------------------------------------
create or replace function public.usun_moje_konto()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ile integer;
begin
  if v_user is null then
    raise exception 'Trzeba być zalogowanym';
  end if;

  -- Zaplecze nie kasuje się tą drogą. Konto z rolą inną niż klient bywa
  -- podpisane pod korektami stanu, zwrotami i wpisami dziennika; jego
  -- usunięcie to decyzja właściciela, nie samoobsługa.
  if exists (
    select 1 from public.user_roles
    where user_id = v_user and role <> 'customer'
  ) then
    raise exception 'Konto pracownika usuwa właściciel — napisz do obsługi';
  end if;

  -- 1. Zamówienia: znika osoba, zostaje dokument.
  update public.orders
  set email = 'usuniete@' || id::text,
      phone = null,
      shipping_address = case
        when shipping_address is null then null
        -- Kraj zostaje: bez niego znika informacja podatkowa, a sam kraj
        -- nikogo nie identyfikuje.
        else jsonb_build_object('country', shipping_address ->> 'country')
      end,
      user_id = null
  where user_id = v_user;

  get diagnostics v_ile = row_count;

  -- 2. Dane własne konta. Listy życzeń, adresy i profil idą kaskadą przy
  --    kasowaniu użytkownika, ale kasujemy je wprost — kaskada jest
  --    właściwością schematu, a ta funkcja ma mówić, co usuwa.
  delete from public.wishlists where user_id = v_user;
  delete from public.addresses where user_id = v_user;
  delete from public.reviews where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from public.user_roles where user_id = v_user;

  -- 3. Konto. Reszta powiązań ma SET NULL albo CASCADE, więc nic nie blokuje.
  delete from auth.users where id = v_user;

  raise notice 'Konto usunięte, zanonimizowanych zamówień: %', v_ile;
end;
$$;

comment on function public.usun_moje_konto() is
  'Usuwa konto wywołującego. Zamówienia zostają jako dokument księgowy, ale bez danych osobowych.';

-- Gość nie ma czego usuwać, a `service_role` omija RLS i nie powinien mieć
-- skrótu do kasowania kont.
revoke execute on function public.usun_moje_konto() from public, anon, service_role;
grant execute on function public.usun_moje_konto() to authenticated;
