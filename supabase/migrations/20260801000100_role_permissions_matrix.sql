-- =============================================================================
-- Nordo — macierz uprawnień jako część schematu, nie danych startowych
--
-- `authorize()` czyta uprawnienia z role_permissions przy każdym sprawdzeniu.
-- Tabela powstawała w 20260727090000, ale wypełniał ją wyłącznie seed.sql —
-- a seeda świadomie nie wgrywamy na produkcję, bo zakłada konta z hasłami
-- wpisanymi w pliku.
--
-- Skutek na wdrożonym projekcie: tabela pusta, więc `authorize()` zwracało
-- false dla każdej roli. Właściciel po nadaniu sobie roli `owner` i tak
-- odbijał się od panelu, bez żadnego komunikatu wyjaśniającego dlaczego.
--
-- To nie są dane demonstracyjne. Bez tych wierszy aplikacja nie działa
-- w żadnym środowisku, więc ich miejsce jest w migracji.
--
-- Kategorie i produkty zostają w seedzie — tamto jest treścią sklepu
-- i na produkcji wpisuje ją właściciel.
-- =============================================================================

insert into public.role_permissions (role, permission) values
  ('owner', 'products.read_all'),
  ('owner', 'products.write'),
  ('owner', 'orders.read_all'),
  ('owner', 'orders.write'),
  ('owner', 'customers.read'),
  ('owner', 'inventory.write'),
  ('owner', 'roles.manage'),
  ('manager', 'products.read_all'),
  ('manager', 'products.write'),
  ('manager', 'orders.read_all'),
  ('manager', 'orders.write'),
  ('manager', 'customers.read'),
  ('manager', 'inventory.write'),
  ('staff', 'products.read_all'),
  ('staff', 'orders.read_all'),
  ('staff', 'orders.write'),
  ('staff', 'inventory.write')
on conflict (role, permission) do nothing;
