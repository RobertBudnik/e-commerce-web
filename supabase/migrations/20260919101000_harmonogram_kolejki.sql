-- =============================================================================
-- Harmonogram: kto budzi pracownika kolejki
--
-- Tabela `zadania` sama się nie wykona. Ktoś musi co jakiś czas zawołać
-- funkcję `zadania`, a jedynym procesem, który w tym stosie chodzi bez
-- żądania użytkownika, jest baza. Stąd pg_cron.
--
-- Alternatywą byłby zewnętrzny harmonogram (GitHub Actions z cronem, Vercel
-- Cron). Odrzucone świadomie: oba dokładają miejsce, w którym trzeba trzymać
-- sekret i adres funkcji, a pg_cron ma je już obok siebie w tej samej bazie,
-- w której leży kolejka. Mniej ruchomych części.
--
-- Uwaga na wydajność: minuta to nie jest „szybko" dla klienta czekającego na
-- potwierdzenie zamówienia. To świadomy kompromis — mail w ciągu minuty jest
-- w zupełności dość, a wybudzanie funkcji co pięć sekund kosztuje bez powodu.
-- Kto chce natychmiast, może zawołać `zadania` wprost po zapisie; kolejka i
-- tak zabezpiecza przypadek, w którym to wywołanie padnie.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Wywołanie pracownika
-- ---------------------------------------------------------------------------
create or replace function public.uruchom_kolejke()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  adres_funkcji text;
  sekret text;
begin
  select wartosc into adres_funkcji from public.konfiguracja_poczty where klucz = 'adres_zadan';
  select wartosc into sekret from public.konfiguracja_poczty where klucz = 'sekret_zadan';

  -- Brak konfiguracji nie może wywracać zaplanowanego zadania — cron
  -- zgłaszałby porażkę co minutę i zapchał własny dziennik.
  if adres_funkcji is null or sekret is null then
    return;
  end if;

  if to_regnamespace('net') is null then
    return;
  end if;

  -- EXECUTE, nie wywołanie wprost: ciało plpgsql jest sprawdzane przy
  -- tworzeniu, więc odwołanie do `net.http_post` wysypałoby migrację
  -- wszędzie tam, gdzie pg_net nie ma.
  execute 'select net.http_post($1, $2, $3, $4, $5)'
  using
    adres_funkcji,
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sekret-zadan', sekret
    ),
    10000;
end;
$$;

comment on function public.uruchom_kolejke() is
  'Budzi funkcję brzegową `zadania`. Woła to pg_cron co minutę.';

revoke all on function public.uruchom_kolejke() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Wpisy w harmonogramie
-- ---------------------------------------------------------------------------
-- `cron.schedule` z tą samą nazwą nadpisuje poprzedni wpis, więc migracja
-- jest idempotentna i można ją zastosować ponownie bez mnożenia zadań.
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron niedostępne — kolejkę trzeba drenować z zewnątrz.';
    return;
  end if;

  perform cron.schedule(
    'kolejka-zadan',
    '* * * * *',
    $cmd$ select public.uruchom_kolejke() $cmd$
  );

  -- Sprzątanie raz na dobę, w nocy. Zrobione zadania starsze niż tydzień
  -- nie niosą informacji, a tabela rośnie z każdym zamówieniem.
  perform cron.schedule(
    'sprzatanie-zadan',
    '17 3 * * *',
    $cmd$ select public.sprzataj_zadania() $cmd$
  );
end $$;
