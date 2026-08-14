'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';
import { money } from '@/lib/format';

const CZAS = 0.8; // s — Motion liczy w sekundach
/** easeOutExpo — ta sama co przy kadrach zdjęć (`--krzywa` w globals.css)
 *  i ten sam czas co `--ruch-kadr`. Cena jest w karcie razem ze zdjęciem,
 *  więc obie rzeczy mają zatrzymywać się w tym samym momencie. */
const KRZYWA: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Cena dolicza się od zera, gdy karta wjedzie w pole widzenia.
 *
 * Raz na kartę. Powtarzanie przy każdym najechaniu zamienia cenę w migający
 * licznik i przy przewijaniu katalogu robi się jarmark — a cena jest jedyną
 * liczbą na kafelku, którą ktoś naprawdę czyta.
 *
 * Wartość docelowa jest w DOM od pierwszego renderu serwera, w warstwie dla
 * czytnika ekranu. Robot indeksujący i czytnik dostają cenę, nie zero
 * w drodze do niej — a to jest cena produktu w sklepie, więc nie ma tu miejsca
 * na dwuznaczność.
 */
export function OdometrCeny({ cena }: { cena: number }) {
  const bezRuchu = useRuchWylaczony();
  const [wartosc, setWartosc] = useState(bezRuchu ? cena : 0);
  // Wartość pośrednia jako MotionValue: `animate` w wariancie reactowym
  // prowadzi MotionValue albo element, nie dwie gołe liczby. Zmiany
  // przepisujemy do stanu, bo tekst renderuje React, nie transform.
  const licznik = useMotionValue(0);
  useMotionValueEvent(licznik, 'change', setWartosc);
  const element = useRef<HTMLSpanElement>(null);
  const wystartowal = useRef(false);

  useEffect(() => {
    if (bezRuchu) {
      setWartosc(cena);
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
        const bieg = animate(licznik, cena, { duration: CZAS, ease: KRZYWA });
        sprzataj = () => bieg.stop();
      },
      { threshold: 0.5 }
    );

    obserwator.observe(node);

    return () => {
      obserwator.disconnect();
      sprzataj?.();
    };
  }, [cena, bezRuchu]);

  return (
    <span ref={element} className="odometr">
      <span className="sr-only">{money(cena)}</span>
      <span aria-hidden="true">{money(wartosc)}</span>
    </span>
  );
}
