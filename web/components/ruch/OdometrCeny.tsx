'use client';

import { useDoliczanie } from '@/lib/doliczanie';
import { money } from '@/lib/format';

/**
 * Cena dolicza się od zera, gdy karta wjedzie w pole widzenia.
 *
 * Mechanikę trzyma `lib/doliczanie.ts` — ten sam silnik co `Licznik`.
 * Próg jest tu wyższy (0,5 zamiast 0,4): cena stoi w kafelku razem
 * ze zdjęciem i ma zatrzymać się w tym samym momencie co kadr.
 *
 * Wartość docelowa jest w DOM od pierwszego renderu serwera, w warstwie dla
 * czytnika ekranu. Robot indeksujący i czytnik dostają cenę, nie zero
 * w drodze do niej — a to jest cena produktu w sklepie, więc nie ma tu miejsca
 * na dwuznaczność.
 */
export function OdometrCeny({ cena }: { cena: number }) {
  const { element, wartosc } = useDoliczanie(cena, 0.5);

  return (
    <span ref={element} className="odometr">
      <span className="sr-only">{money(cena)}</span>
      <span aria-hidden="true">{money(wartosc)}</span>
    </span>
  );
}
