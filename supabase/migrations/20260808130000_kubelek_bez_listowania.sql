-- =============================================================================
-- Nordo — kubełek zdjęć bez prawa listowania
--
-- Linter Supabase: `0025_public_bucket_allows_listing`.
--
-- Polityka „zdjęcia: odczyt publiczny" dawała rolom `anon` i `authenticated`
-- SELECT na `storage.objects` dla całego kubełka. Do wyświetlenia zdjęcia nie
-- jest potrzebna: kubełek jest publiczny, więc pobranie pliku po adresie
-- omija RLS z definicji. Ta polityka daje coś innego — prawo **wylistowania**
-- zawartości, czyli poznania wszystkich nazw plików w kubełku.
--
-- Co to znaczy w praktyce: adresy zdjęć są losowymi UUID-ami, więc bez listy
-- nikt ich nie zgadnie. Z listą wystarczy jedno wywołanie `storage.list()`
-- kluczem `anon`, który leży w kodzie strony, żeby dostać komplet — razem ze
-- zdjęciami produktów wycofanych z katalogu i takich, które jeszcze nie
-- wyszły na sklep.
--
-- Kod sklepu nigdy nie listuje tego kubełka. Sprawdzone: jedyne wywołania to
-- `upload()` i `remove()` w `web/app/actions/catalog.ts`. Polityka odczytu
-- zostaje więc wyłącznie dla zaplecza — panel może chcieć kiedyś pokazać, co
-- leży w kubełku, a `products.write` ma tylko ten, komu właściciel je nadał.
-- =============================================================================

drop policy if exists "zdjęcia: odczyt publiczny" on storage.objects;

create policy "zdjęcia: listowanie dla zaplecza" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.authorize('products.write'))
  );

-- =============================================================================
-- cancel_order przestaje być wywoływalne bez logowania
--
-- Linter: `0028_anon_security_definer_function_executable`.
--
-- Większość zgłoszeń tego typu opisuje wzorzec, który ten schemat stosuje
-- świadomie: funkcja jest SECURITY DEFINER, bo musi ruszyć magazyn albo kupony,
-- i sprawdza uprawnienia po swojej stronie. `create_order` i `quote_order` są
-- wystawione gościom celowo — bez tego nie da się kupić bez konta.
-- `authorize`, `is_staff` i `current_role_name` muszą być wykonywalne przez
-- `anon`, bo wołają je same polityki RLS przy każdym zapytaniu gościa.
--
-- `cancel_order` jest wyjątkiem: niezalogowany nie ma czego anulować, bo
-- funkcja i tak odmawia przy braku `auth.uid()`. Prawo było zbędne od początku
-- — zostało po `create function`, które nadaje EXECUTE roli PUBLIC z automatu,
-- a domyślne uprawnienia Supabase dokładają jawne granty dla `anon`.
--
-- Wykorzystać się tego nie dało, ale zbędne prawo to szerszy promień rażenia,
-- gdy ktoś kiedyś doda gałąź kodu przed sprawdzeniem uprawnień. Ta sama
-- decyzja co w 20260807080000 przy funkcjach magazynu.
-- =============================================================================

revoke execute on function public.cancel_order(uuid) from anon, public;
grant execute on function public.cancel_order(uuid) to authenticated;
