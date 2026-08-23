-- =============================================================================
-- Nordo — shop_events przestaje przyjmować zapisy od niezalogowanych
--
-- Stan zastany: rola `anon` miała `GRANT INSERT`, a polityka „zdarzenia: zapis"
-- przepuszczała wiersz z `user_id IS NULL`. Razem dawało to niezalogowanemu
-- prawo wstawiania dowolnych wierszy wprost przez PostgREST:
--
--   POST /rest/v1/shop_events   kluczem anon   →   201, wiersz w bazie
--
-- Bez limitu częstotliwości i bez retencji. Ślad po analityce, która nigdy nie
-- została podłączona: jedyny kod piszący do tej tabeli (`zapiszZdarzenie`
-- w web/app/actions/slad.ts) nie jest importowany w żadnym miejscu, a jedyny
-- widok, który z niej czyta (`zainteresowanie_produktow`), nie jest odpytywany
-- przez aplikację. Utarg i sprzedaż liczą się z `orders` i `order_items`, więc
-- wstrzyknięte wiersze nie brudziły finansów — ale tabela stała otworem dla
-- każdego, kto znalazł klucz anon w kodzie strony. A ten leży tam z definicji.
--
-- Dlaczego cofamy prawo, a nie kasujemy tabeli: zamiar był sensowny i pomiar
-- zainteresowania produktem może jeszcze wrócić. Zostawiamy więc `authenticated`
-- — zapis zalogowanego jest przypisany do konta, czyli policzalny i możliwy do
-- ograniczenia. Gość zostaje bez prawa zapisu do odwołania.
--
-- Gdyby pomiar miał kiedyś obejmować także gości, właściwą drogą nie jest
-- przywrócenie tego grantu, tylko funkcja SECURITY DEFINER z własnym limitem
-- — tak jak `quote_order` i `create_order`, które są wystawione gościom
-- świadomie, bo bez nich nie da się kupić bez konta.
-- =============================================================================

revoke insert on public.shop_events from anon;

-- Polityka zapisu przestaje dotyczyć gościa, więc zawęża się do zalogowanych.
-- Sam warunek zostaje: konto zapisuje zdarzenie własne albo bez przypisania.
drop policy if exists "zdarzenia: zapis" on public.shop_events;

create policy "zdarzenia: zapis zalogowanego" on public.shop_events
  for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));
