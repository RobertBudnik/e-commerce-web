-- =============================================================================
-- Nordo — przypisanie uprawnień panelu do ról
--
-- W migracji, nie w seedzie: seed nie jedzie na produkcję, a `authorize()`
-- czyta uprawnienia z tej tabeli przy każdym sprawdzeniu. Pusty wiersz znaczy
-- odmowę bez komunikatu — dokładnie ten błąd zamykała już migracja
-- 20260801000100 przy podstawowej macierzy.
--
-- Kto co dostaje:
--
--   owner    jedno i drugie — to jego pieniądze i jego odpowiedzialność
--   manager  finanse, bo prowadzi sklep na co dzień; dziennika nie, bo audyt
--            ma sens tylko wtedy, gdy czyta go ktoś inny niż audytowany
--   staff    nic z tej dwójki
-- =============================================================================

insert into public.role_permissions (role, permission) values
  ('owner', 'finanse.read'),
  ('owner', 'audyt.read'),
  ('manager', 'finanse.read')
on conflict (role, permission) do nothing;
