-- =============================================================================
-- Nordo — polityki RLS liczone raz na zapytanie, plus indeksy pod klucze obce
--
-- 1. `auth.uid()` i `authorize()` wołane wprost w polityce Postgres przelicza
--    DLA KAŻDEGO WIERSZA. Obie zależą wyłącznie od tokenu, nie od wiersza,
--    więc `(select ...)` pozwala planiście policzyć je raz i wstawić stałą.
--    Przy ośmiu produktach różnicy nie widać; przy kilku tysiącach zamówień
--    to różnica między skanem a odczytem z indeksu.
--
--    Lint: 0003_auth_rls_initplan.
--
-- 2. Polityki `FOR ALL` obejmują też SELECT, więc na tabeli, która ma osobną
--    politykę odczytu, każdy SELECT wykonywał obie. Rozbicie `ALL` na zapisy
--    zostawia przy odczycie jedną politykę.
--
--    Lint: 0006_multiple_permissive_policies.
--
-- 3. Klucz obcy bez indeksu oznacza skan tabeli podrzędnej przy każdym
--    kasowaniu lub zmianie klucza w tabeli nadrzędnej.
--
--    Lint: 0001_unindexed_foreign_keys.
--
-- Zakres uprawnień nie zmienia się ani o jotę — te same warunki, inny sposób
-- ich policzenia. Testy schematu (`npm run db:test`) sprawdzają to wprost.
-- =============================================================================

-- ---------- profiles ----------
drop policy if exists "profil: odczyt własnego" on public.profiles;
create policy "profil: odczyt własnego" on public.profiles
  for select using (
    id = (select auth.uid()) or (select public.authorize('customers.read'))
  );

drop policy if exists "profil: edycja własnego" on public.profiles;
create policy "profil: edycja własnego" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- user_roles ----------
drop policy if exists "role: odczyt własnych" on public.user_roles;
create policy "role: odczyt własnych" on public.user_roles
  for select using (
    user_id = (select auth.uid()) or (select public.authorize('roles.manage'))
  );

-- ---------- addresses ----------
drop policy if exists "adresy: odczyt" on public.addresses;
create policy "adresy: odczyt" on public.addresses
  for select using (
    user_id = (select auth.uid()) or (select public.authorize('customers.read'))
  );

drop policy if exists "adresy: dodawanie" on public.addresses;
create policy "adresy: dodawanie" on public.addresses
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "adresy: edycja" on public.addresses;
create policy "adresy: edycja" on public.addresses
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "adresy: usuwanie" on public.addresses;
create policy "adresy: usuwanie" on public.addresses
  for delete using (user_id = (select auth.uid()));

-- ---------- orders ----------
drop policy if exists "zamówienia: odczyt własnych" on public.orders;
create policy "zamówienia: odczyt własnych" on public.orders
  for select using (
    user_id = (select auth.uid()) or (select public.authorize('orders.read_all'))
  );

-- ---------- order_items ----------
-- `pozycje: obsługa` była FOR ALL, więc dokładała się do każdego SELECT-a obok
-- polityki odczytu. Zapisy dostają własne polityki, odczyt zostaje jeden.
drop policy if exists "pozycje: obsługa" on public.order_items;

create policy "pozycje: dopisanie przez zaplecze" on public.order_items
  for insert with check ((select public.authorize('orders.write')));

create policy "pozycje: zmiana przez zaplecze" on public.order_items
  for update using ((select public.authorize('orders.write')))
  with check ((select public.authorize('orders.write')));

create policy "pozycje: kasowanie przez zaplecze" on public.order_items
  for delete using ((select public.authorize('orders.write')));

drop policy if exists "pozycje: odczyt" on public.order_items;
create policy "pozycje: odczyt" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = (select auth.uid()) or (select public.authorize('orders.read_all')))
    )
  );

-- ---------- categories ----------
-- Ten sam wzorzec: odczyt jest publiczny, więc polityka zapisu nie ma powodu
-- dokładać się do SELECT-ów.
drop policy if exists "kategorie: zapis" on public.categories;

create policy "kategorie: dodawanie" on public.categories
  for insert with check ((select public.authorize('products.write')));

create policy "kategorie: zmiana" on public.categories
  for update using ((select public.authorize('products.write')))
  with check ((select public.authorize('products.write')));

create policy "kategorie: kasowanie" on public.categories
  for delete using ((select public.authorize('products.write')));

-- ---------- wishlists ----------
drop policy if exists "lista życzeń: własna" on public.wishlists;
create policy "lista życzeń: własna" on public.wishlists
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- shop_events ----------
drop policy if exists "zdarzenia: zapis" on public.shop_events;
create policy "zdarzenia: zapis" on public.shop_events
  for insert with check (user_id is null or user_id = (select auth.uid()));

-- ---------- zwroty ----------
drop policy if exists "zwroty: odczyt właściciela i zaplecza" on public.zwroty;
create policy "zwroty: odczyt właściciela i zaplecza" on public.zwroty
  for select using (
    (select public.authorize('orders.read_all'))
    or exists (
      select 1 from public.orders o
      where o.id = zwroty.order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "zwroty: zgłoszenie przez właściciela zamówienia" on public.zwroty;
create policy "zwroty: zgłoszenie przez właściciela zamówienia" on public.zwroty
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = zwroty.order_id and o.user_id = (select auth.uid())
    )
  );

-- ---------- zwroty_pozycje ----------
drop policy if exists "pozycje zwrotu: odczyt jak zwrot" on public.zwroty_pozycje;
create policy "pozycje zwrotu: odczyt jak zwrot" on public.zwroty_pozycje
  for select using (
    exists (
      select 1 from public.zwroty z
      where z.id = zwroty_pozycje.zwrot_id
        and (
          (select public.authorize('orders.read_all'))
          or exists (
            select 1 from public.orders o
            where o.id = z.order_id and o.user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "pozycje zwrotu: dopisanie przy własnym zgłoszeniu" on public.zwroty_pozycje;
create policy "pozycje zwrotu: dopisanie przy własnym zgłoszeniu" on public.zwroty_pozycje
  for insert with check (
    exists (
      select 1 from public.zwroty z
      join public.orders o on o.id = z.order_id
      where z.id = zwroty_pozycje.zwrot_id and o.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- Indeksy pod klucze obce
--
-- Nie ruszamy indeksów zgłoszonych jako „nieużywane" (0005_unused_index).
-- Produkcja ma za sobą kilkanaście zamówień, więc statystyka użycia mówi
-- głównie tyle, że sklep dopiero rusza. `products_barcode_lookup` obsługuje
-- skaner wdrożony w tym tygodniu, a `orders_status_idx` kolejkę magazynu —
-- kasowanie ich na podstawie tej próbki byłoby wróżeniem.
-- =============================================================================

create index if not exists inventory_movements_created_by_idx
  on public.inventory_movements (created_by);

create index if not exists order_items_product_idx
  on public.order_items (product_id);

create index if not exists orders_coupon_idx
  on public.orders (coupon_code);

create index if not exists shop_events_user_idx
  on public.shop_events (user_id);

create index if not exists wishlists_product_idx
  on public.wishlists (product_id);

create index if not exists zwroty_order_idx
  on public.zwroty (order_id);

create index if not exists zwroty_przyjety_by_idx
  on public.zwroty (przyjety_by);

create index if not exists zwroty_pozycje_product_idx
  on public.zwroty_pozycje (product_id);
