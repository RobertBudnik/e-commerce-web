-- =============================================================================
-- Nordo — widoki analityczne
--
-- Sprzedaż liczy się z `orders` i `order_items`, zainteresowanie z `shop_events`.
-- Mieszanie tych dwóch źródeł w jednym widoku to najprostsza droga do dwóch
-- różnych liczb na jednym ekranie, więc każdy widok trzyma się swojego.
--
-- Definicja przychodu, jedna dla wszystkich: zamówienia opłacone i nieanulowane.
-- Zamówienie w stanie „oczekuje" nie jest sprzedażą, tylko nadzieją.
--
-- `security_invoker = true` przy każdym widoku. Bez tego widok wykonuje się
-- z prawami właściciela i omija RLS tabel źródłowych — czyli klient, który
-- trafi pod `/rest/v1/sprzedaz_dziennie`, zobaczyłby cudze zamówienia.
-- Z tym ustawieniem widok dziedziczy polityki i klientowi oddaje jego własne
-- wiersze: statystykę bezsensowną, ale bezpieczną.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Przychód w czasie
-- ---------------------------------------------------------------------------
create or replace view public.sprzedaz_dziennie as
select
  date_trunc('day', o.created_at)::date as dzien,
  count(*)                              as zamowien,
  sum(o.total_cents)                    as przychod_cents,
  -- Dzielenie całkowite: kwoty są w groszach i mają takie zostać.
  sum(o.total_cents) / count(*)         as srednia_cents,
  sum(o.discount_cents)                 as rabaty_cents,
  sum(o.shipping_cents)                 as dostawa_cents
from public.orders o
where o.payment_status = 'opłacone'
  and o.status <> 'anulowane'
group by 1;

alter view public.sprzedaz_dziennie set (security_invoker = true);

comment on view public.sprzedaz_dziennie is
  'Przychód, liczba zamówień i średnia wartość per dzień. Tylko opłacone i nieanulowane.';

-- ---------------------------------------------------------------------------
-- Sprzedaż produktów
--
-- Nazwa z `order_items`, nie z `products`: pozycja zamówienia trzyma nazwę
-- z chwili zakupu, więc raport nie zmienia się wstecz po zmianie katalogu.
-- ---------------------------------------------------------------------------
create or replace view public.sprzedaz_produktow as
select
  oi.product_id,
  oi.name,
  sum(oi.qty)                 as sztuk,
  sum(oi.line_total_cents)    as przychod_cents,
  count(distinct oi.order_id) as zamowien
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.payment_status = 'opłacone'
  and o.status <> 'anulowane'
group by 1, 2;

alter view public.sprzedaz_produktow set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Zainteresowanie produktem
--
-- Sama liczba odsłon nic nie mówi: pozycja ze strony głównej zawsze wygra
-- z pozycją z trzeciej kategorii. Miarą jest stosunek odsłon do zakupów.
--
-- Konwersja w promilach, bo liczba całkowita czyta się lepiej niż 0.0234,
-- a przy kilkudziesięciu odsłonach procent zaokrągla wszystko do zera.
--
-- Okno trzydziestu dni jest wpisane w widok świadomie: raport „od zawsze"
-- przy sklepie, który zmienia asortyment, miesza ze sobą dwa różne sklepy.
-- ---------------------------------------------------------------------------
create or replace view public.zainteresowanie_produktow as
with odslony as (
  select product_id, count(*) as ile
  from public.shop_events
  where event = 'wejscie_na_produkt'
    and product_id is not null
    and created_at > now() - interval '30 days'
  group by 1
),
koszyki as (
  select product_id, count(*) as ile
  from public.shop_events
  where event = 'dodanie_do_koszyka'
    and product_id is not null
    and created_at > now() - interval '30 days'
  group by 1
),
porzucenia as (
  select product_id, count(*) as ile
  from public.shop_events
  where event = 'usuniecie_z_koszyka'
    and product_id is not null
    and created_at > now() - interval '30 days'
  group by 1
),
zakupy as (
  select oi.product_id, sum(oi.qty) as ile
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.payment_status = 'opłacone'
    and o.status <> 'anulowane'
    and o.created_at > now() - interval '30 days'
  group by 1
)
select
  p.id,
  p.name,
  p.stock,
  coalesce(o.ile, 0) as odslon,
  coalesce(k.ile, 0) as do_koszyka,
  coalesce(u.ile, 0) as z_koszyka,
  coalesce(z.ile, 0) as kupionych,
  case
    when coalesce(o.ile, 0) = 0 then null
    else (coalesce(z.ile, 0) * 1000) / o.ile
  end as konwersja_promile
from public.products p
left join odslony    o on o.product_id = p.id
left join koszyki    k on k.product_id = p.id
left join porzucenia u on u.product_id = p.id
left join zakupy     z on z.product_id = p.id
where p.is_active;

alter view public.zainteresowanie_produktow set (security_invoker = true);

comment on view public.zainteresowanie_produktow is
  'Odsłony, koszyki i zakupy per produkt za 30 dni. Konwersja w promilach.';

grant select on public.sprzedaz_dziennie, public.sprzedaz_produktow,
  public.zainteresowanie_produktow to authenticated;
