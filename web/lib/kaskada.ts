/**
 * Opóźnienie kolejnych elementów w kaskadzie odsłaniania.
 *
 * Pierwiastek, nie mnożenie liniowe: przy stałym kroku dwunasty kafelek czeka
 * dwanaście kroków i wejście siatki zaczyna trwać dłużej niż przewinięcie do
 * niej. Pierwiastek zagęszcza ogon — różnica między pierwszym a drugim jest
 * słyszalna, między jedenastym a dwunastym już nie, i tak ma być.
 *
 * Sufit na jedenastce: dalej opóźnienie i tak przestaje rosnąć sensownie,
 * a w siatce po dwadzieścia kafelków ostatni rząd wchodziłby z sekundą zwłoki.
 *
 * Funkcja siedzi w osobnym pliku bez `'use client'`, bo liczą z niej oba
 * światy: klientowa `ProductGrid` i serwerowa strona główna.
 */
export function opoznienieKaskady(i: number): number {
  return Math.round(70 * Math.sqrt(Math.min(i, 11)));
}
