-- =============================================================================
-- Nowy stan zamówienia: „spakowane"
--
-- Kolejka w aplikacji magazynowej ma trzy zakładki: Nowe, Spakowane, Wysłane.
-- Dotąd między „nowe" a „wysłane" stało „w realizacji" — stan opisujący
-- wszystko i nic. Paczka spakowana i czekająca na kuriera to inna sytuacja
-- niż paczka, której nikt jeszcze nie tknął, i magazynier musi je rozróżniać
-- bez zaglądania do kartonu.
--
-- „w realizacji" zostaje w typie: używają go zamówienia sprzed tej zmiany
-- i usunięcie wartości z enuma wymagałoby przepisania tabeli.
--
-- Osobna migracja, bo `alter type ... add value` nie może dodać wartości
-- i użyć jej w tej samej transakcji. Kolumny i funkcje idą w następnej.
-- =============================================================================

alter type public.order_status add value if not exists 'spakowane' before 'wysłane';
