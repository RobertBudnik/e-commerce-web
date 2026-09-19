-- =============================================================================
-- Szukanie w katalogu z rankingiem trafień
--
-- Dotąd szukanie było jednym `or=(name.ilike.%x%,short.ilike.%x%)` i sortowało
-- się tym, co akurat wybrał klient — popularnością albo ceną. Skutek: kto
-- wpisał pełną nazwę produktu, dostawał go na czwartym miejscu, bo trzy inne
-- były popularniejsze. Baymard nazywa to wprost: dokładne trafienie ma stać
-- pierwsze, bo człowiek, który wpisuje pełną nazwę, już wie, czego chce.
--
-- PostgREST sortuje wyłącznie po kolumnach, nie po wyrażeniu, więc rankingu
-- nie da się dopisać do dotychczasowego zapytania. Stąd funkcja: liczy rangę
-- w SQL-u, a dopiero w jej obrębie stosuje sortowanie wybrane przez klienta.
--
-- Ścieżka bez frazy zostaje w PostgREST — działa dobrze i nie ma powodu jej
-- ruszać. Ta funkcja obsługuje wyłącznie szukanie.
-- =============================================================================

create or replace function public.katalog_szukaj(
  p_fraza text,
  p_kategoria text default null,
  p_sort text default 'trafnosc',
  p_od integer default 0,
  p_ile integer default 12
)
returns table (
  produkt public.products,
  laczna bigint
)
language sql
stable
set search_path = public
as $$
  with fraza as (
    -- Znaki wieloznaczne LIKE trzeba uciec, inaczej klient wpisujący „50%"
    -- dostaje wszystko. `\` jako znak ucieczki, zgodnie z domyślnym LIKE.
    select
      btrim(p_fraza) as surowa,
      replace(replace(replace(btrim(p_fraza), '\', '\\'), '%', '\%'), '_', '\_') as bezpieczna
  ),
  dopasowane as (
    select
      p,
      case
        -- 0: dokładnie ta nazwa. Kto wpisał pełną nazwę, ma ją dostać pierwszą.
        when lower(p.name) = lower(f.surowa) then 0
        -- 1: nazwa zaczyna się od frazy — „kubek" trafia „Kubek popiołowy".
        when lower(p.name) like lower(f.bezpieczna) || '%' escape '\' then 1
        -- 2: fraza gdzieś w nazwie.
        when lower(p.name) like '%' || lower(f.bezpieczna) || '%' escape '\' then 2
        -- 3: dopiero opis. Trafienie w opisie jest słabsze od trafienia
        --    w nazwie i nigdy nie ma prawa go wyprzedzić.
        else 3
      end as ranga
    from public.products p, fraza f
    where p.is_active
      and (p_kategoria is null or p_kategoria = 'all' or p.category_id = p_kategoria)
      and (
        lower(p.name) like '%' || lower(f.bezpieczna) || '%' escape '\'
        or lower(coalesce(p.short, '')) like '%' || lower(f.bezpieczna) || '%' escape '\'
        or lower(coalesce(p.description, '')) like '%' || lower(f.bezpieczna) || '%' escape '\'
      )
  ),
  policzone as (
    select count(*) as laczna from dopasowane
  )
  select d.p, c.laczna
  from dopasowane d, policzone c
  order by
    -- Ranga zawsze pierwsza. Sortowanie wybrane przez klienta rozstrzyga
    -- dopiero wewnątrz jednej rangi — inaczej „najtańsze" wypchnęłoby
    -- dokładne trafienie pod tanie przypadkowe.
    d.ranga,
    case when p_sort = 'price-asc' then (d.p).price_cents end asc nulls last,
    case when p_sort = 'price-desc' then (d.p).price_cents end desc nulls last,
    case when p_sort = 'rating' then (d.p).rating end desc nulls last,
    case when p_sort = 'nowosc' then (d.p).created_at end desc nulls last,
    case when p_sort = 'name' then lower((d.p).name) end asc nulls last,
    case when p_sort = 'popular' then (d.p).reviews_count end desc nulls last,
    -- Remisy rozstrzyga identyfikator. Bez tego dwie pozycje o tej samej
    -- randze i cenie potrafią zamienić się miejscami między stronami,
    -- a wtedy jedna z nich znika z wyników.
    (d.p).id
  limit greatest(p_ile, 0)
  offset greatest(p_od, 0);
$$;

comment on function public.katalog_szukaj(text, text, text, integer, integer) is
  'Szukanie w katalogu z rankingiem: dokładna nazwa, początek nazwy, nazwa, opis. '
  'Sortowanie klienta działa wewnątrz rangi. Zwraca też łączną liczbę trafień.';

grant execute on function public.katalog_szukaj(text, text, text, integer, integer)
  to anon, authenticated;

-- Szukanie idzie po `lower(... like '%fraza%')`, czyli bez indeksu przegląda
-- całą tabelę. Przy kilkuset produktach to bez znaczenia, przy kilku tysiącach
-- już tak. `pg_trgm` obsługuje LIKE z wiodącym `%`, czego zwykły btree nie
-- potrafi. Rozszerzenie bywa w innej schemie na hoście niż lokalnie, więc
-- zakładamy indeksy tylko wtedy, gdy operator naprawdę jest dostępny —
-- inaczej migracja wywracałaby się tam, gdzie pg_trgm nie ma.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists products_name_trgm on public.products using gin (lower(name) gin_trgm_ops)';
    execute 'create index if not exists products_short_trgm on public.products using gin (lower(coalesce(short, '''')) gin_trgm_ops)';
  end if;
end;
$$;
