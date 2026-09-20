'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useRuchWylaczony } from './ruch';

/** s — sufit z motion systemu Figmy, nigdy więcej. */
const CZAS = 0.8;

/**
 * easeOutExpo — ta sama krzywa, co przy kadrach zdjęć (`--krzywa`
 * w globals.css). Liczba rusza mocno i długo dohamowuje, więc ostatnie cyfry
 * da się przeczytać, zamiast oglądać sam bęben.
 */
const KRZYWA: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Liczba dolicza się od zera, gdy element wjedzie w pole widzenia.
 *
 * Wspólny silnik `Licznik` i `OdometrCeny` — dwa komponenty miały ten sam
 * `IntersectionObserver`, tę samą `MotionValue` przepisywaną do stanu i tę
 * samą krzywą, różniąc się wyłącznie progiem i formatowaniem wyniku.
 *
 * **Raz na element.** Powtarzanie przy każdym powrocie do sekcji zamienia
 * statystykę w zabawkę, a katalog cen w jarmark.
 *
 * Wartość docelową wywołujący ma wypisać w warstwie dla czytnika ekranu —
 * ten hak prowadzi tylko warstwę widoczną. Ktoś, kto słucha strony, ma
 * usłyszeć cenę, a nie zero w drodze do niej.
 *
 * `prefers-reduced-motion` ustawia wartość docelową od razu i nie obserwuje
 * niczego.
 */
export function useDoliczanie(cel: number, prog: number) {
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
      { threshold: prog }
    );

    obserwator.observe(node);

    return () => {
      obserwator.disconnect();
      sprzataj?.();
    };
  }, [cel, prog, bezRuchu, licznik]);

  return { element, wartosc };
}
