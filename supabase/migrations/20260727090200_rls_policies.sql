-- =============================================================================
-- Nordo — Row Level Security
-- Reguły siedzą w bazie, więc obowiązują tak samo stronę, panel zaplecza,
-- aplikację magazynową i każdego, kto strzeli w API bezpośrednio.
-- Klucz service_role omija RLS — używać go wyłącznie w Edge Functions.
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.addresses           enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.coupons             enable row level security;
alter table public.store_settings      enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.wishlists           enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — swój profil; zaplecze z uprawnieniem czyta wszystkie
-- ---------------------------------------------------------------------------
create policy "profil: odczyt własnego" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.authorize('customers.read'));

create policy "profil: edycja własnego" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_roles — widzisz swoje role, nadaje je wyłącznie roles.manage.
-- To jest zamek na eskalację uprawnień: klient nie dopisze sobie 'owner'.
-- ---------------------------------------------------------------------------
create policy "role: odczyt własnych" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.authorize('roles.manage'));

create policy "role: nadawanie" on public.user_roles
  for insert to authenticated
  with check (public.authorize('roles.manage'));

create policy "role: zmiana" on public.user_roles
  for update to authenticated
  using (public.authorize('roles.manage'))
  with check (public.authorize('roles.manage'));

create policy "role: odbieranie" on public.user_roles
  for delete to authenticated
  using (public.authorize('roles.manage'));

create policy "uprawnienia: odczyt" on public.role_permissions
  for select to authenticated
  using (public.authorize('roles.manage'));

-- ---------------------------------------------------------------------------
-- addresses — wyłącznie własne; zaplecze czyta do wysyłki
-- ---------------------------------------------------------------------------
create policy "adresy: odczyt" on public.addresses
  for select to authenticated
  using (user_id = auth.uid() or public.authorize('customers.read'));

create policy "adresy: dodawanie" on public.addresses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "adresy: edycja" on public.addresses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "adresy: usuwanie" on public.addresses
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories i products — katalog czytelny dla wszystkich, zapis dla zaplecza
-- ---------------------------------------------------------------------------
create policy "kategorie: odczyt publiczny" on public.categories
  for select to anon, authenticated
  using (true);

create policy "kategorie: zapis" on public.categories
  for all to authenticated
  using (public.authorize('products.write'))
  with check (public.authorize('products.write'));

create policy "produkty: odczyt publiczny" on public.products
  for select to anon, authenticated
  using (is_active or public.authorize('products.read_all'));

create policy "produkty: dodawanie" on public.products
  for insert to authenticated
  with check (public.authorize('products.write'));

create policy "produkty: edycja" on public.products
  for update to authenticated
  using (public.authorize('products.write'))
  with check (public.authorize('products.write'));

create policy "produkty: usuwanie" on public.products
  for delete to authenticated
  using (public.authorize('products.write'));

-- ---------------------------------------------------------------------------
-- inventory_movements — historia magazynu tylko dla zaplecza
-- ---------------------------------------------------------------------------
create policy "magazyn: odczyt" on public.inventory_movements
  for select to authenticated
  using (public.authorize('inventory.write') or public.authorize('orders.read_all'));

-- ---------------------------------------------------------------------------
-- coupons — kody nie wyciekają do przeglądarki; sprawdza je create_order
-- ---------------------------------------------------------------------------
create policy "kupony: zaplecze" on public.coupons
  for all to authenticated
  using (public.authorize('products.write'))
  with check (public.authorize('products.write'));

-- ---------------------------------------------------------------------------
-- store_settings — próg darmowej dostawy widoczny publicznie, zmiana dla zarządcy
-- ---------------------------------------------------------------------------
create policy "ustawienia: odczyt publiczny" on public.store_settings
  for select to anon, authenticated
  using (true);

create policy "ustawienia: zmiana" on public.store_settings
  for update to authenticated
  using (public.authorize('products.write'))
  with check (public.authorize('products.write'));

-- ---------------------------------------------------------------------------
-- orders — klient widzi wyłącznie swoje.
-- Brak polityki INSERT: zamówienia powstają tylko przez create_order().
-- ---------------------------------------------------------------------------
create policy "zamówienia: odczyt własnych" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.authorize('orders.read_all'));

create policy "zamówienia: obsługa" on public.orders
  for update to authenticated
  using (public.authorize('orders.write'))
  with check (public.authorize('orders.write'));

create policy "pozycje: odczyt" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.authorize('orders.read_all'))
    )
  );

create policy "pozycje: obsługa" on public.order_items
  for all to authenticated
  using (public.authorize('orders.write'))
  with check (public.authorize('orders.write'));

-- ---------------------------------------------------------------------------
-- wishlists — prywatne, bez podglądu przez zaplecze
-- ---------------------------------------------------------------------------
create policy "lista życzeń: własna" on public.wishlists
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Uprawnienia ról względem tabel (RLS działa dopiero po GRANT)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.categories, public.products, public.store_settings to anon, authenticated;
grant select, insert, update, delete on public.addresses, public.wishlists to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.inventory_movements, public.user_roles to authenticated;
grant insert, update, delete on public.products, public.categories, public.coupons to authenticated;
grant update on public.orders, public.store_settings to authenticated;
grant insert, update, delete on public.order_items, public.user_roles to authenticated;
grant select on public.role_permissions, public.coupons to authenticated;
grant usage, select on all sequences in schema public to authenticated;
