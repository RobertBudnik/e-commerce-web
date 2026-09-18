-- =============================================================================
-- Limity wysyłki poczty — po adresie IP i po adresie e-mail
--
-- Supabase ma własny limit, ale liczy go WYŁĄCZNIE po adresie IP. To zostawia
-- otwartą drugą drogę nadużycia: jeden napastnik, wiele adresów IP, jedna
-- cudza skrzynka. Ofiara dostaje kilkadziesiąt wiadomości „potwierdź konto"
-- i to nasza domena zbiera za to skargi, nie napastnik.
--
-- Stąd druga warstwa, licząca także po adresie. Adresu nie zapisujemy —
-- w tabeli ląduje skrót SHA-256. Po pierwsze nie mnożymy miejsc, w których
-- leżą cudze adresy; po drugie do sprawdzenia limitu skrót wystarcza, bo
-- pytanie brzmi „czy ten sam adres pytał już pięć razy", a nie „jaki to był
-- adres".
--
-- Tabela nie ma polityk RLS i to jest zamierzone: RLS jest włączone, więc bez
-- polityk nikt nie sięgnie do niej bezpośrednio. Jedyną drogą jest funkcja
-- niżej, uruchamiana z prawami właściciela.
-- =============================================================================

create table public.limity_poczty (
  id uuid primary key default gen_random_uuid(),
  -- 'ip:<adres>' albo 'email:<sha256>' — prefiks trzyma obie przestrzenie
  -- rozdzielone, żeby adres IP nie mógł udawać skrótu adresu e-mail.
  klucz text not null,
  rodzaj text not null check (rodzaj in ('rejestracja', 'reset', 'magic', 'ponowna')),
  kiedy timestamptz not null default now()
);

alter table public.limity_poczty enable row level security;

-- Zapytanie funkcji brzmi zawsze „ile wpisów dla tego klucza i rodzaju po
-- danej chwili", więc indeks idzie dokładnie w tej kolejności.
create index limity_poczty_okno_idx
  on public.limity_poczty (klucz, rodzaj, kiedy desc);

comment on table public.limity_poczty is
  'Okno przesuwne wysyłek poczty. Klucz to adres IP albo skrót SHA-256 adresu e-mail.';

-- ---------------------------------------------------------------------------
-- Skrót adresu — jedno miejsce, żeby aplikacja i baza liczyły go tak samo
-- ---------------------------------------------------------------------------
create or replace function public.skrot_adresu(p_email text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  -- Małe litery i obcięte spacje, bo „Jan@X.pl " i „jan@x.pl" to jedna skrzynka.
  select encode(extensions.digest(lower(btrim(p_email)), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Sprawdzenie i zapis w jednym kroku
--
-- Jedno wywołanie zamiast „policz, potem dopisz": między tymi dwoma krokami
-- mieści się drugie żądanie i limit przecieka. Tutaj liczenie i wpis siedzą
-- w jednej transakcji.
--
-- Zwraca `true`, gdy wolno wysłać (i wtedy zapisuje próbę), `false`, gdy okno
-- jest wyczerpane (i wtedy nie zapisuje nic — inaczej odbita próba
-- przedłużałaby blokadę w nieskończoność).
-- ---------------------------------------------------------------------------
create or replace function public.limit_poczty(
  p_klucz text,
  p_rodzaj text,
  p_ile integer,
  p_sekundy integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  od timestamptz := now() - make_interval(secs => p_sekundy);
  juz integer;
begin
  if coalesce(btrim(p_klucz), '') = '' then
    -- Brak klucza znaczy, że wołający nie wie, kogo ogranicza. Przepuszczenie
    -- takiego wywołania robiłoby z limitu ozdobę.
    raise exception 'Klucz limitu jest wymagany';
  end if;

  -- Sprzątanie przy okazji: wiersze starsze od najdłuższego okna, jakiego
  -- używamy, nie odpowiedzą już na żadne pytanie. Bez tego tabela rośnie
  -- w nieskończoność, bo kluczy jest tyle, ile adresów na świecie.
  delete from public.limity_poczty
  where kiedy < now() - interval '24 hours';

  select count(*) into juz
  from public.limity_poczty
  where klucz = p_klucz
    and rodzaj = p_rodzaj
    and kiedy >= od;

  if juz >= p_ile then
    return false;
  end if;

  insert into public.limity_poczty (klucz, rodzaj) values (p_klucz, p_rodzaj);
  return true;
end;
$$;

-- Wołają to także goście — rejestracja i reset hasła dzieją się przed
-- zalogowaniem. `anon` musi mieć prawo, ale wyłącznie do tej funkcji:
-- sama tabela zostaje zamknięta.
revoke execute on function public.limit_poczty(text, text, integer, integer)
  from public;
grant execute on function public.limit_poczty(text, text, integer, integer)
  to anon, authenticated;

revoke execute on function public.skrot_adresu(text) from public;
grant execute on function public.skrot_adresu(text) to anon, authenticated;
