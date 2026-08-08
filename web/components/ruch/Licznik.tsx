'use client';

import { useEffect, useRef, useState } from 'react';
import { animuj, easeOutCubic, useRuchWylaczony } from '@/lib/ruch';

const CZAS = 900; // ms — z tabeli „Zaawansowany ruch"

/**
 * Liczba dolicza się od zera, gdy wjedzie w pole widzenia.
 *
 * Licznik startuje raz. Powtarzanie przy każdym powrocie do sekcji zamienia
 * statystykę w zabawkę i po trzecim przewinięciu zaczyna irytować.
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
  const bezRuchu = useRuchWylaczony();
  const [wartosc, setWartosc] = useState(bezRuchu ? cel : 0);
  const element = useRef<HTMLSpanElement>(null);
  const wystartowal = useRef(false);

  useEffect(() => {
    if (bezRuchu) {
      setWartosc(cel);
      return;
    }

    const node = element.current;
    if (!node || wystartowal.current) return;

    let sprzataj: (() => void) | undefined;

    const obserwator = new IntersectionObserver(
      (wpisy) => {
        if (!wpisy[0]?.isIntersecting || wystartowal.current) return;
        wystartowal.current = true;
        obserwator.disconnect();

        sprzataj = animuj(CZAS, (postep) => {
          setWartosc(cel * easeOutCubic(postep));
        });
      },
      { threshold: 0.4 }
    );

    obserwator.observe(node);

    return () => {
      obserwator.disconnect();
      sprzataj?.();
    };
  }, [cel, bezRuchu]);

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
