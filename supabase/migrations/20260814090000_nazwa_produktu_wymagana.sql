-- =============================================================================
-- Nordo — produkt musi mieć nazwę
--
-- `products.name` jest NOT NULL od początku, ale pusty ciąg przechodził przez
-- to sito. Skutek widać było na produkcji: w katalogu stał kafel z kategorią,
-- ceną i dziurą w miejscu tytułu, a karta produktu nie miała nagłówka.
-- Formularz panelu pilnował tego po stronie przeglądarki, czyli tam, gdzie
-- pilnowanie niczego nie gwarantuje — klucz `anon` leży w kodzie strony.
--
-- `not valid` jest tu celowe i nie jest półśrodkiem. Postgres pomija przy
-- dodaniu wiersze, które już są, ale **egzekwuje warunek przy każdym insercie
-- i każdym update'cie** — łącznie z tym, którym właściciel nazwie w końcu
-- swój bezimienny produkt. Gdyby warunek wchodził od razu jako `valid`,
-- migracja odbiłaby się od tego jednego wiersza i nie weszła w ogóle, a
-- kasowanie cudzego towaru w migracji nie wchodzi w grę.
--
-- Gdy stare wiersze będą już nazwane, warunek domyka się jednym poleceniem:
--
--   alter table public.products validate constraint produkt_ma_nazwe;
-- =============================================================================

alter table public.products
  add constraint produkt_ma_nazwe check (btrim(name) <> '') not valid;

comment on constraint produkt_ma_nazwe on public.products is
  'Nazwa nie może być pusta. not valid — wiersze sprzed wdrożenia czekają na uzupełnienie.';

-- Slug jedzie w adresie karty produktu; pusty daje trasę /produkt/ i 404.
alter table public.products
  add constraint produkt_ma_slug check (btrim(slug) <> '') not valid;

comment on constraint produkt_ma_slug on public.products is
  'Slug nie może być pusty — bez niego karta produktu nie ma adresu.';
