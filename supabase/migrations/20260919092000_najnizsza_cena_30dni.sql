-- =============================================================================
-- Najniższa cena z 30 dni (dyrektywa Omnibus)
--
-- Art. 4 ust. 2 dyrektywy 98/6/WE w brzmieniu nadanym przez Omnibus, wdrożony
-- w Polsce ustawą o informowaniu o cenach: **przy każdej obniżce trzeba podać
-- najniższą cenę z 30 dni przed jej wprowadzeniem**. Pokazanie samej ceny
-- przekreślonej bez tej informacji jest naruszeniem, za które UOKiK karze.
--
-- Dlaczego to nie jest zwykłe `min(cena_cents)` po wierszach z ostatnich
-- 30 dni:
--
--   `historia_cen` zapisuje **zmiany**, nie stan każdego dnia. Produkt, który
--   kosztował 100 zł przez pół roku i wczoraj stracił 20%, ma w oknie 30 dni
--   dokładnie jeden wiersz — ten wczorajszy, z ceną 80 zł. Naiwne `min()`
--   po tych wierszach odpowiedziałoby „najniższa cena z 30 dni: 80 zł",
--   czyli tyle, ile kosztuje teraz. Informacja byłaby bezużyteczna i nieprawdziwa.
--
--   Trzeba więc dołożyć cenę **obowiązującą w chwili otwarcia okna** — czyli
--   z ostatniej zmiany sprzed 30 dni. Gdy takiej zmiany nie ma (produkt jest
--   młodszy niż 30 dni), oknem jest całe jego życie i wystarczą same wiersze
--   historii plus cena bieżąca.
-- =============================================================================

create or replace function public.najnizsza_cena_30dni(p_produkty uuid[])
returns table (product_id uuid, najnizsza_cents integer)
language sql
stable
set search_path = public
as $$
  with okno as (
    select (now() - interval '30 days') as od
  ),
  wybrane as (
    select p.id, p.price_cents
    from public.products p
    where p.id = any(p_produkty)
  ),
  -- Zmiany zapisane w oknie.
  w_oknie as (
    select h.product_id, min(h.cena_cents) as najnizsza
    from public.historia_cen h, okno o
    where h.product_id = any(p_produkty)
      and h.created_at >= o.od
    group by h.product_id
  ),
  -- Cena obowiązująca w chwili otwarcia okna: ostatnia zmiana sprzed 30 dni.
  -- `distinct on` zamiast okienkowej — czytelniejsze i tańsze przy indeksie
  -- (product_id, created_at desc), który ta tabela już ma.
  na_starcie as (
    select distinct on (h.product_id) h.product_id, h.cena_cents
    from public.historia_cen h, okno o
    where h.product_id = any(p_produkty)
      and h.created_at < o.od
    order by h.product_id, h.created_at desc
  )
  select
    w.id,
    least(
      -- Cena bieżąca zawsze wchodzi do porównania: obowiązuje dziś, czyli
      -- w oknie, nawet gdy nie ma po niej żadnego wpisu w historii.
      w.price_cents,
      coalesce(o.najnizsza, w.price_cents),
      coalesce(s.cena_cents, w.price_cents)
    )::integer
  from wybrane w
  left join w_oknie o on o.product_id = w.id
  left join na_starcie s on s.product_id = w.id;
$$;

comment on function public.najnizsza_cena_30dni(uuid[]) is
  'Najniższa cena z ostatnich 30 dni dla podanych produktów (Omnibus). '
  'Uwzględnia cenę obowiązującą w chwili otwarcia okna, nie tylko zmiany w oknie.';

-- Odczyt jest publiczny, bo informacja musi stać przy produkcie w sklepie —
-- tak samo jak sama tabela `historia_cen`.
grant execute on function public.najnizsza_cena_30dni(uuid[]) to anon, authenticated;
