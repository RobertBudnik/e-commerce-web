/**
 * Odmiana rzeczowników przez liczbę.
 *
 * Polski ma trzy formy tam, gdzie angielski ma dwie, więc `${n} pozycji`
 * daje „1 pozycji" przy każdym zamówieniu z jedną pozycją. `Intl.PluralRules`
 * zna reguły języka, w tym te nieoczywiste: 22 idzie jak 2, ale 12 jak 5.
 */
const REGULY = new Intl.PluralRules('pl-PL');

/** Formy w kolejności: 1 · 2–4 · 5+ (np. `['pozycja', 'pozycje', 'pozycji']`). */
export type Formy = readonly [jeden: string, kilka: string, wiele: string];

/** Sama forma, bez liczby. */
export function odmien(n: number, [jeden, kilka, wiele]: Formy): string {
  switch (REGULY.select(n)) {
    case 'one':
      return jeden;
    case 'few':
      return kilka;
    default:
      // `many` i `other` schodzą się w polskim do tej samej formy dopełniacza;
      // `other` łapie też ułamki, gdzie i tak mówimy „1,5 pozycji".
      return wiele;
  }
}

/** Liczba razem z formą — „1 pozycja", „2 pozycje", „5 pozycji". */
export function ile(n: number, formy: Formy): string {
  return `${n} ${odmien(n, formy)}`;
}

/* Zestawy używane w więcej niż jednym miejscu. */
export const POZYCJE: Formy = ['pozycja', 'pozycje', 'pozycji'];
export const SZTUKI: Formy = ['sztuka', 'sztuki', 'sztuk'];
export const PRODUKTY: Formy = ['produkt', 'produkty', 'produktów'];
export const ZWROTY: Formy = ['zwrot', 'zwroty', 'zwrotów'];
export const ZAMOWIENIA: Formy = ['zamówienie', 'zamówienia', 'zamówień'];
