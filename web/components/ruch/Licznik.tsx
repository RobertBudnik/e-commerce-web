'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

const CZAS = 0.9; // s — Motion liczy w sekundach
const KRZYWA: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

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
  // Wartość pośrednia jako MotionValue: `animate` w wariancie reactowym
  // prowadzi MotionValue albo element, nie dwie gołe liczby. Zmiany
  // przepisujemy do stanu, bo tekst renderuje React, nie transform.
  const licznik = useMotionValue(0);
  useMotionValueEvent(licznik, 'change', setWartosc);
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

        licznik.set(0);
        const bieg = animate(licznik, cel, { duration: CZAS, ease: KRZYWA });
        sprzataj = () => bieg.stop();
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
