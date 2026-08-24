-- =============================================================================
-- Nordo — retencja danych
--
-- Audyt wykazał zero mechanizmów czyszczących: brak `pg_cron`, jedenaście
-- wyzwalaczy (wszystkie przeliczają, żaden nie kasuje), dwadzieścia dziewięć
-- funkcji bez ani jednej sprzątającej. Retencja 90 dni opisana w
-- `docs/analityka-plan.md` nigdy nie została wdrożona.
--
-- Czego ta migracja NIE rusza i dlaczego:
--
--   orders, order_items      dokumenty sprzedaży; okres przechowywania
--                            narzuca prawo podatkowe, nie my
--   zwroty, zwroty_pozycje   to samo — dowód rozliczenia z konsumentem
--   historia_cen             Omnibus wymaga pokazania najniższej ceny
--                            z ostatnich 30 dni; skasowanie historii
--                            odbiera możliwość wykazania, że cena była
--                            prawdziwa
--   koszty_*                 podstawa rozliczeń, nie dane osobowe
--   dziennik_zaplecza        patrz niżej, to jest osobna decyzja
--
-- Dziennik zaplecza zostaje nietknięty świadomie. Tabela jest dopisywalna
-- i nic więcej — nie ma polityki `update` ani `delete`, bo wpis, który da się
-- poprawić, przestaje być dowodem i staje się notatnikiem. Dokładanie do niej
-- funkcji kasującej przeczyłoby tej decyzji, a jej okres przechowywania wynika
-- z rozliczalności, nie z wygody. To pozycja do rozstrzygnięcia przez
-- właściciela razem z prawnikiem, nie przy okazji sprzątania analityki.
-- =============================================================================

create or replace function public.posprzataj_dane(
  p_dni_zdarzenia integer default 90,
  p_dni_frazy integer default 30
)
returns table (co text, skasowanych bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ile bigint;
begin
  if p_dni_zdarzenia < 1 or p_dni_frazy < 1 then
    raise exception 'Okres retencji liczony w dniach musi być dodatni';
  end if;

  -- 1. Frazy wyszukiwania starzeją się szybciej niż reszta zdarzenia.
  --
  -- `detail` przy zdarzeniu `szukanie` to tekst wpisany przez człowieka —
  -- a ludzie wpisują w wyszukiwarkę rzeczy, których wpisywać nie zamierzali,
  -- łącznie z danymi, które nie mają prawa u nas leżeć. Sam fakt szukania
  -- jest przydatny w statystyce dłużej niż jego treść, więc kasujemy treść,
  -- zostawiając zdarzenie.
  update public.shop_events
  set detail = null
  where event = 'szukanie'
    and detail is not null
    and created_at < now() - make_interval(days => p_dni_frazy);

  get diagnostics v_ile = row_count;
  co := 'frazy wyszukiwania wyczyszczone';
  skasowanych := v_ile;
  return next;

  -- 2. Surowe zdarzenia po okresie retencji.
  --
  -- Agregaty liczą się z widoków w locie, więc skasowanie surowych wierszy
  -- skraca okno raportu, ale niczego nie fałszuje. Bez tego po roku widok
  -- „co się dzieje w sklepie" skanuje miliony wierszy, żeby narysować
  -- siedem słupków.
  delete from public.shop_events
  where created_at < now() - make_interval(days => p_dni_zdarzenia);

  get diagnostics v_ile = row_count;
  co := 'zdarzenia sklepu skasowane';
  skasowanych := v_ile;
  return next;
end;
$$;

comment on function public.posprzataj_dane(integer, integer) is
  'Retencja danych analitycznych. Nie dotyka dokumentów sprzedaży ani dziennika zaplecza.';

-- Sprzątanie nie jest czynnością klienta ani zaplecza — to zadanie
-- utrzymaniowe. Wywołuje je harmonogram albo właściciel z konsoli.
revoke execute on function public.posprzataj_dane(integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Jak to uruchamiać cyklicznie
--
-- Świadomie nie włączamy tu `pg_cron`. Rozszerzenie trzeba włączyć na projekcie
-- (Database → Extensions), a zadanie zapisane w migracji zaczęłoby chodzić na
-- każdym środowisku, które tę migrację nałoży — łącznie z kopiami roboczymi,
-- gdzie kasowanie danych w tle jest ostatnią rzeczą, jakiej się spodziewamy.
--
-- Po włączeniu rozszerzenia wystarczy:
--
--   select cron.schedule(
--     'retencja-nordo', '17 3 * * *',
--     $cron$ select public.posprzataj_dane(); $cron$
--   );
--
-- Godzina nierówna celowo: o pełnej godzinie startuje wszystko inne.
--
-- Zanim włączysz harmonogram, uruchom funkcję ręcznie i zobacz, co zwróci.
-- Pierwsze wywołanie na bazie, która nigdy nie była czyszczona, kasuje
-- najwięcej i jest jedynym momentem, w którym pomyłka w okresie retencji
-- jest jeszcze odwracalna kopią zapasową.
-- ---------------------------------------------------------------------------
