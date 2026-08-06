-- =============================================================================
-- Brakujący klucz obcy na inventory_movements.order_id
--
-- Kolumna od początku trzymała identyfikator zamówienia, ale bez ograniczenia:
-- `take_stock` i `return_stock` wpisywały tam `p_order_id` i nikt nie
-- sprawdzał, czy takie zamówienie istnieje. Dwa skutki, oba realne.
--
-- Po pierwsze osierocone wiersze: usunięcie zamówienia zostawiało w historii
-- magazynu identyfikator prowadzący donikąd.
--
-- Po drugie, mniej oczywisty: PostgREST buduje dołączenia wyłącznie na
-- kluczach obcych. Bez tego `select ... orders(order_number)` nie jest
-- zapytaniem wolniejszym — jest zapytaniem błędnym, a widok historii
-- dostawał pustą listę zamiast ruchów. Ekran „Ostatnie ruchy" pokazywał
-- „Brak ruchów dzisiaj" mimo ruchów w bazie.
--
-- `on delete set null`, nie `cascade`: skasowanie zamówienia nie może
-- wymazać ruchu magazynowego. Towar fizycznie wyjechał i historia ma to
-- pamiętać, nawet gdy zamówienie zniknie.
-- =============================================================================

-- Wiersze wskazujące na nieistniejące zamówienia trzeba odciąć przed
-- założeniem ograniczenia — inaczej `alter table` odmówi.
update public.inventory_movements m
set order_id = null
where order_id is not null
  and not exists (select 1 from public.orders o where o.id = m.order_id);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_order_id_fkey;

alter table public.inventory_movements
  add constraint inventory_movements_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete set null;

create index if not exists inventory_movements_order_idx
  on public.inventory_movements (order_id) where order_id is not null;
