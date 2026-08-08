-- =============================================================================
-- Nordo — szukanie po stronie bazy
--
-- `/sklep` pobierało cały katalog i filtrowało go w pamięci przeglądarki.
-- Przy ośmiu produktach to była świadoma decyzja i tak stało w komentarzu przy
-- `ShopBrowser`. Przy stu jest to sto rekordów wysyłanych po to, żeby pokazać
-- dwanaście, a przy tysiącu — strona, która nie wstaje na telefonie.
--
-- Indeksy trigramowe zamiast pełnotekstowych. Wyszukiwanie pełnotekstowe
-- w Postgresie potrzebuje słownika języka; konfiguracji polskiej nie ma tu
-- z pudełka, a `simple` nie odmienia, więc „słuchawki" nie znajdzie
-- „słuchawek". Trigramy nie znają odmiany w ogóle, ale radzą sobie
-- z fragmentem słowa i literówką — a tego właśnie szuka ktoś, kto wpisuje
-- „sluchaw" w pole nad siatką.
--
-- `gin_trgm_ops` obsługuje `ilike '%fraza%'`, którego zwykły btree nie umie
-- przyspieszyć: wiodący znak wieloznaczny wyklucza użycie indeksu.
-- =============================================================================

-- Blok warunkowy, bo testy schematu (`npm run db:test`) biegną na Postgresie
-- skompilowanym do WebAssembly, a tam `pg_trgm` nie istnieje. Ten sam wzorzec
-- co przy grantach dla `supabase_auth_admin` w 20260727090300: środowisko
-- testowe ma przejść, a wdrożone dostać indeksy.
--
-- Samo szukanie działa w obu przypadkach — `ilike` nie potrzebuje indeksu,
-- żeby zwrócić poprawny wynik. Bez niego jest tylko wolniejsze, a przy ośmiu
-- produktach w seedzie nie ma czego przyspieszać.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    raise notice 'Brak pg_trgm — pomijam indeksy trigramowe (środowisko testowe)';
    return;
  end if;

  create extension if not exists pg_trgm with schema extensions;

  create index if not exists products_nazwa_trgm
    on public.products using gin (name extensions.gin_trgm_ops);

  create index if not exists products_short_trgm
    on public.products using gin (short extensions.gin_trgm_ops);

  comment on index public.products_nazwa_trgm is
    'Szukanie po fragmencie nazwy (ilike %fraza%). Trigramy, bo słownika polskiego do FTS tu nie ma.';
end $$;

-- Sortowania z listy w sklepie. Bez tych indeksów każda zmiana kolejności
-- to sortowanie całej tabeli, a stronicowanie robi to przy każdej stronie.
create index if not exists products_cena_idx
  on public.products (price_cents) where is_active;

create index if not exists products_ocena_idx
  on public.products (rating desc) where is_active;

create index if not exists products_opinie_idx
  on public.products (reviews_count desc) where is_active;
