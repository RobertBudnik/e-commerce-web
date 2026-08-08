'use client';

import { useEffect, useRef, useState } from 'react';
import { animuj, easeOutCubic, useRuchWylaczony } from '@/lib/ruch';
import { money } from '@/lib/format';

const CZAS = 500; // ms — z tabeli „Zaawansowany ruch"

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

        sprzataj = animuj(CZAS, (postep) => {
          setWartosc(cena * easeOutCubic(postep));
        });
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
