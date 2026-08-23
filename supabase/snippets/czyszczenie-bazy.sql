-- =============================================================================
-- Czyszczenie bazy — zostaje jedno konto właściciela i słowniki
--
-- NIE URUCHAMIAJ TEGO OD RAZU. Kolejność czytania:
--   1. zrób kopię: Supabase → Database → Backups
--   2. uruchom sekcję A i przeczytaj, co masz
--   3. wpisz swój identyfikator w sekcji B
--   4. uruchom sekcję C jako całość — jest w transakcji
--   5. sprawdź sekcją D, czy zostało to, co miało zostać
--
-- Skrypt kasuje dane handlowe: zamówienia, zwroty, opinie, ruchy magazynowe,
-- katalog, koszyki, listy życzeń, dziennik. Zostawia: Twoje konto, Twoją rolę,
-- słowniki uprawnień i ustawienia sklepu.
--
-- Czego ten skrypt NIE robi świadomie:
--   · nie kasuje kont z auth.users poza wskazanym wyjątkiem — usuwanie
--     użytkowników zrób w panelu Supabase, gdzie widzisz, kogo kasujesz
--   · nie rusza plików w kubełku obrazów — te zostają osierocone i trzeba je
--     posprzątać osobno w Storage
--   · nie kasuje danych Stripe'a — subskrypcje i płatności żyją po ich stronie
-- =============================================================================


-- ── A. Co jest w bazie ───────────────────────────────────────────────────────
-- Uruchom sam, przeczytaj, dopiero potem idź dalej.

select relname as tabela, n_live_tup as wierszy
from pg_stat_user_tables
where schemaname = 'public' and n_live_tup > 0
order by n_live_tup desc, relname;

-- Które konto jest właścicielem — stąd bierzesz identyfikator do sekcji B.
select u.id, u.email, u.created_at, r.role
from auth.users u
join public.user_roles r on r.user_id = u.id
where r.role = 'owner'
order by u.created_at;


-- ── B. Twoje konto ───────────────────────────────────────────────────────────
-- Podmień identyfikator na ten z zapytania wyżej. Reszta skryptu opiera się
-- wyłącznie na tej jednej wartości.

-- \set moje_konto '00000000-0000-0000-0000-000000000000'
--
-- W edytorze SQL Supabase nie ma \set — zamiast tego wstaw identyfikator
-- wprost w miejsca oznaczone TWOJE_KONTO niżej. Jest ich cztery.


-- ── C. Czyszczenie ───────────────────────────────────────────────────────────
-- Wszystko w jednej transakcji: albo przejdzie w całości, albo nic.
-- Kolejność wynika z kluczy obcych — dzieci przed rodzicami.

begin;

-- Pozycje i dokumenty zwrotów
delete from public.zwroty_pozycje;
delete from public.zwroty;

-- Opinie i ich pochodne
delete from public.reviews;

-- Zamówienia: pozycje, potem nagłówki
delete from public.order_items;
delete from public.orders;

-- Magazyn i finanse produktu
delete from public.inventory_movements;
delete from public.historia_cen;
delete from public.koszty_produktow;

-- Zdarzenia sklepu i dziennik zaplecza
delete from public.shop_events;
delete from public.dziennik;

-- Listy życzeń i koszyki wszystkich, łącznie z Twoim — koszyk to stan
-- chwilowy, nie dane, które warto ratować
delete from public.wishlists;
delete from public.carts;

-- Katalog: obrazy, produkty, kategorie
delete from public.product_images;
delete from public.products;
delete from public.categories;

-- Role i profile wszystkich poza Tobą. Rolę właściciela zostawiamy, inaczej
-- stracisz dostęp do panelu w tej samej transakcji, w której go czyścisz.
delete from public.user_roles where user_id <> 'TWOJE_KONTO';
delete from public.profiles  where id      <> 'TWOJE_KONTO';

-- Sprawdzenie przed zatwierdzeniem: musi zostać dokładnie jedna rola owner
-- i dokładnie Twoja. Jeśli tu wyjdzie zero, NIE zatwierdzaj.
select count(*) as twoja_rola_owner
from public.user_roles
where user_id = 'TWOJE_KONTO' and role = 'owner';

-- Przeczytaj wynik wyżej. Jeśli jest 1 — zatwierdź:
commit;
-- Jeśli cokolwiek wygląda źle:
-- rollback;


-- ── D. Po czyszczeniu ────────────────────────────────────────────────────────

select relname as tabela, n_live_tup as wierszy
from pg_stat_user_tables
where schemaname = 'public' and n_live_tup > 0
order by n_live_tup desc, relname;

-- Warunki, które czekały na uporządkowanie danych — teraz można je domknąć
-- na stałe, bo bezimiennego produktu już nie ma.
alter table public.products validate constraint produkt_ma_nazwe;
alter table public.products validate constraint produkt_ma_slug;
