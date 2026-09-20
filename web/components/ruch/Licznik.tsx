'use client';

import { useDoliczanie } from '@/lib/doliczanie';

/**
 * Liczba dolicza się od zera, gdy wjedzie w pole widzenia.
 *
 * Mechanikę — obserwator, krzywa, jeden bieg na element — trzyma
 * `lib/doliczanie.ts`; tutaj zostaje samo formatowanie i warstwa dla
 * czytnika ekranu.
 *
 * Wartość docelowa jest w DOM od początku, w warstwie dla czytnika ekranu —
 * animowana jest tylko warstwa widoczna. Ktoś, kto słucha strony, ma usłyszeć
 * „120 tysięcy zamówień", a nie ciąg liczb w drodze do celu.
 */
export function Licznik({
  do: cel,
  sufiks = '',
  ulamek = 0,
  etykieta,
}: {
  do: number;
  sufiks?: string;
  /** Miejsca po przecinku — średnia ocen ma jedno, liczba zamówień żadnego. */
  ulamek?: number;
  /** Pełny odczyt dla czytnika ekranu, np. „120 tysięcy zamówień". */
  etykieta: string;
}) {
  const { element, wartosc } = useDoliczanie(cel, 0.4);

  const pokaz =
    ulamek > 0
      ? wartosc.toFixed(ulamek).replace('.', ',')
      : Math.round(wartosc).toLocaleString('pl-PL');

  return (
    <span ref={element}>
      <span className="sr-only">{etykieta}</span>
      <span aria-hidden="true">
        {pokaz}
        {sufiks}
      </span>
    </span>
  );
}
