-- =============================================================================
-- Nordo — odebranie roli PUBLIC prawa uruchamiania funkcji wewnętrznych
--
-- Postgres nadaje EXECUTE roli PUBLIC każdej nowo utworzonej funkcji. `anon`
-- i `authenticated` dziedziczą po PUBLIC, więc odebranie prawa wyłącznie im
-- niczego nie zmienia — grant po PUBLIC zostaje i funkcja dalej wisi pod
-- /rest/v1/rpc/<nazwa>.
--
-- Migracja 20260727090100 robiła dokładnie to:
--
--   revoke execute on function public.mark_order_paid(...) from anon, authenticated;
--
-- Efekt na wdrożonym projekcie: `has_function_privilege('anon', ...)` zwracało
-- `true`. Trzy funkcje bez własnego sprawdzenia uprawnień stały otworem dla
-- każdego, kto ma klucz `anon` — a ten klucz jest publiczny z założenia,
-- leży w kodzie strony:
--
--   mark_order_paid  zamówienie oznaczone jako opłacone bez płatności
--   take_stock       zdjęcie dowolnej ilości towaru z magazynu
--   return_stock     dopisanie dowolnej ilości towaru do magazynu
--
-- Wzorzec zrobiony poprawnie jest w 20260727090300 przy haśle dostępowym:
-- tam odebranie obejmuje `public` i dlatego działa.
--
-- Funkcje wywoływane wewnątrz create_order() i cancel_order() nie tracą nic:
-- tamte są SECURITY DEFINER i wykonują się z prawami właściciela.
--
-- adjust_stock i cancel_order zostawiamy dostępne — mają własne sprawdzenie
-- przez authorize() i są świadomie wystawione zalogowanym.
-- =============================================================================

revoke execute on function public.take_stock(uuid, integer, text, uuid)
  from public, anon, authenticated;

revoke execute on function public.return_stock(uuid, integer, text, uuid)
  from public, anon, authenticated;

revoke execute on function public.mark_order_paid(uuid, text, text)
  from public, anon, authenticated;

-- Funkcja wyzwalacza. Wywołuje ją Postgres przy wstawianiu wiersza do
-- auth.users, nikt nie ma powodu sięgać do niej przez API.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- Hook roli. Odebranie jest już w 20260727090300, ale siedzi tam wewnątrz
-- bloku warunkowego, który wykonuje się dopiero przy istniejącej roli
-- supabase_auth_admin. Testy schematu biegną na Postgresie w WASM, gdzie tej
-- roli nie ma — blok się nie wykonywał i luka nie miała jak zostać złapana.
-- Tu bezwarunkowo, żeby środowisko testowe odpowiadało wdrożonemu.
revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;

-- =============================================================================
-- Ustalony search_path dla funkcji, którym go brakowało
--
-- Bez `set search_path` funkcja rozwiązuje nazwy tabel według ścieżki roli,
-- która ją wywołuje. Przy funkcji uruchamianej z cudzymi prawami to droga do
-- podstawienia własnej tabeli pod nazwę, po którą sięga kod.
--
-- custom_access_token_hook biegnie jako supabase_auth_admin przy każdym
-- wydaniu tokenu — to najbardziej wrażliwe miejsce w całym schemacie.
-- =============================================================================

alter function public.custom_access_token_hook(jsonb) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
