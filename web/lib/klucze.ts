/**
 * Nazwy, pod którymi sklep zapisuje coś w przeglądarce.
 *
 * Są tu, bo każda z nich jest czytana w innym pliku niż zapisywana, a literał
 * powtórzony w dwóch miejscach rozjeżdża się przy pierwszej zmianie: motyw
 * zapisuje `ThemeToggle`, a czyta skrypt blokujący z layoutu.
 *
 * Nazwy są **bez marki**. Poprzednie nosiły ją w sobie (`nordo-theme`) i przy
 * zmianie nazwy sklepu trzeba było ruszać zapis przeglądarki razem z tekstami
 * na stronie — czyli płacić zmianą zachowania za zmianę szyldu.
 */

/** Wybrany motyw: `'dark'` albo `'light'`. Brak wpisu znaczy „jak system". */
export const KLUCZ_MOTYWU = 'motyw';

/**
 * Poprzednia nazwa klucza motywu.
 *
 * Czytana jeszcze przez jedno wdrożenie, żeby ktoś, kto wybrał motyw ręcznie,
 * nie dostał przy wejściu cudzego ustawienia. Do skasowania po sezonie —
 * wtedy zostanie samo `KLUCZ_MOTYWU`.
 */
export const KLUCZ_MOTYWU_STARY = 'nordo-theme';

/** Szkic produktu w panelu — treść formularza przed zapisem. */
export const KLUCZ_SZKICU_PRODUKTU = 'szkic-produktu';
