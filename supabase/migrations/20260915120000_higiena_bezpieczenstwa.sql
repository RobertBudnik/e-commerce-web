-- Higiena z audytu bezpieczeństwa (advisory Supabase).
--
-- Same poprawki wydajnościowe — żadna nie zmienia granic uprawnień. Twardych
-- luk audyt nie znalazł: RLS trzyma na wszystkich tabelach, a wrażliwe RPC
-- sprawdzają authorize() w ciele. Uwaga osobno: ochrona przed wyciekłymi
-- hasłami (HaveIBeenPwned) jest ustawieniem hostowanego Auth, nie ma jej
-- w config.toml — włącza się w panelu Supabase (Authentication → Passwords).

-- 1. Indeksy pod klucze obce (advisor: unindexed_foreign_keys).
--    Bez nich skan cudzych zmian w dzienniku i historii cen po autorze
--    idzie sekwencyjnie. `if not exists`, bo skan mógł je już dołożyć.
create index if not exists dziennik_zaplecza_kto_idx
  on public.dziennik_zaplecza (kto);

create index if not exists historia_cen_zmienil_idx
  on public.historia_cen (zmienil);

-- 2. reviews: dwie permisywne polityki UPDATE dla tej samej roli i akcji
--    (advisor: multiple_permissive_policies) — każde żądanie liczyło obie.
--    Scalamy w jedną o IDENTYCZNEJ semantyce: Postgres łączy polityki
--    permisywne przez OR, więc jawne OR w USING i WITH CHECK nic nie zmienia
--    poza jednym przejściem zamiast dwóch.
--
--      - właściciel edytuje wyłącznie własną opinię i tylko jako
--        'opublikowana' (nie przełknie jej w inny status),
--      - zaplecze z orders.write moderuje dowolną bez tego ograniczenia.
drop policy if exists "opinie: zmiana własnej" on public.reviews;
drop policy if exists "opinie: moderacja" on public.reviews;

create policy "opinie: zmiana" on public.reviews
  for update
  using (
    user_id = (select auth.uid())
    or (select public.authorize('orders.write'))
  )
  with check (
    (user_id = (select auth.uid()) and status = 'opublikowana')
    or (select public.authorize('orders.write'))
  );
