-- =============================================================================
-- Mail powitalny — wyzwalany potwierdzeniem konta, nie wysłaniem formularza
--
-- Różnica jest zasadnicza. Powitanie wysłane przy submicie trafia na każdy
-- adres, jaki ktoś wpisze — także cudzy i także zmyślony. Powitanie po
-- potwierdzeniu trafia wyłącznie tam, gdzie ktoś naprawdę odebrał pocztę
-- i kliknął, czyli dokładnie do właściciela skrzynki.
--
-- Dlaczego wyzwalacz w bazie, a nie wywołanie z route handlera:
-- potwierdzenie bywa klikane na innym urządzeniu, w innej przeglądarce,
-- czasem godzinę później. Wtedy nasz kod w Next.js już nie żyje. Baza widzi
-- każdą drogę potwierdzenia — także tę przez Admin API i tę z panelu
-- Supabase — bo wszystkie kończą się tym samym zapisem w `auth.users`.
-- =============================================================================

-- pg_net ma w pliku kontrolnym ustaloną schemę `net` i nie jest przenoszalne,
-- więc `with schema …` wysypałoby migrację. Stąd goły `create extension`
-- i `net.` przed wywołaniem niżej.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Konfiguracja wysyłki
--
-- Adres funkcji i wspólny sekret muszą skądś przyjść, a wyzwalacz nie ma
-- dostępu do zmiennych środowiskowych. Tabela z włączonym RLS i bez żadnej
-- polityki: czyta ją wyłącznie funkcja uruchamiana z prawami właściciela.
-- ---------------------------------------------------------------------------
create table public.konfiguracja_poczty (
  klucz text primary key,
  wartosc text not null,
  zmieniono timestamptz not null default now()
);

alter table public.konfiguracja_poczty enable row level security;

comment on table public.konfiguracja_poczty is
  'Adres funkcji powitalnej i wspólny sekret. Bez polityk RLS — czyta tylko wyzwalacz.';

-- ---------------------------------------------------------------------------
-- Kto już dostał powitanie
--
-- `auth.users` bywa aktualizowane przy każdym logowaniu, zmianie hasła
-- i odświeżeniu tokenu. Bez osobnego zapisu ten sam człowiek dostawałby
-- powitanie za każdym razem, gdy cokolwiek ruszy w jego wierszu.
-- ---------------------------------------------------------------------------
create table public.powitania (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wyslano timestamptz not null default now()
);

alter table public.powitania enable row level security;

comment on table public.powitania is
  'Jedno powitanie na konto. Klucz główny po user_id jest tu całą logiką.';

-- ---------------------------------------------------------------------------
-- Wyzwalacz
-- ---------------------------------------------------------------------------
create or replace function public.zglos_powitanie()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  adres_funkcji text;
  sekret text;
begin
  -- Interesuje nas jedno przejście: konto niepotwierdzone staje się
  -- potwierdzone. Każda inna zmiana w wierszu przelatuje bez echa.
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;

  -- Druga bramka, na wypadek gdyby pierwsza kiedyś przepuściła: wstawienie
  -- się nie powiedzie, jeśli powitanie już poszło, i wtedy kończymy.
  insert into public.powitania (user_id) values (new.id)
  on conflict (user_id) do nothing;

  if not found then
    return new;
  end if;

  select wartosc into adres_funkcji from public.konfiguracja_poczty where klucz = 'adres_powitania';
  select wartosc into sekret from public.konfiguracja_poczty where klucz = 'sekret_powitania';

  -- Brak konfiguracji nie może wywrócić potwierdzenia konta. Człowiek ma
  -- wejść na swoje konto nawet wtedy, gdy poczta jest niedostrojona —
  -- powitanie jest miłe, ale nie jest częścią rejestracji.
  if adres_funkcji is null or sekret is null then
    return new;
  end if;

  -- `net.http_post` jest asynchroniczne: wpis ląduje w kolejce pg_net,
  -- a transakcja potwierdzenia konta kończy się natychmiast. Gdyby to było
  -- wywołanie synchroniczne, awaria dostawcy poczty blokowałaby logowanie.
  perform net.http_post(
    url := adres_funkcji,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sekret-powitania', sekret
    ),
    body := jsonb_build_object(
      'user_id', new.id,
      'email', new.email,
      'imie', coalesce(new.raw_user_meta_data ->> 'full_name', '')
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Powitanie nigdy nie może zablokować potwierdzenia konta. Wyjątek
    -- zjadamy świadomie i zostawiamy ślad w logu serwera.
    raise warning 'Powitanie nie poszło dla %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.zglos_powitanie();

revoke execute on function public.zglos_powitanie() from public, anon, authenticated;
