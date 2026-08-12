-- =============================================================================
-- Nordo — uprawnienia panelu właściciela
--
-- Zaplecze rozrasta się o dwa obszary, których nie da się opisać istniejącymi
-- uprawnieniami:
--
--   finanse.read  przychód, marża, eksport dla księgowej
--   audyt.read    dziennik zmian w zapleczu
--
-- Rozdzielone od `orders.read_all` celowo. Księgowa ma widzieć kwoty bez
-- adresów klientów, a `staff` ma pakować paczki bez wglądu w marżę sklepu.
-- Jedno uprawnienie na oba te obszary znaczyłoby, że każdy, kto widzi kolejkę
-- wysyłek, widzi też, ile właściciel zarabia.
--
-- Osobna migracja, bo `alter type ... add value` nie może dodać wartości
-- i użyć jej w tej samej transakcji. Przypisania do ról idą w następnej.
-- =============================================================================

alter type public.app_permission add value if not exists 'finanse.read';
alter type public.app_permission add value if not exists 'audyt.read';
