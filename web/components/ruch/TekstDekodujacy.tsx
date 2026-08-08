'use client';

import { useEffect, useState } from 'react';
import { useRuchWylaczony } from '@/lib/ruch';

/** Znaki podmieniane w trakcie dekodowania. Bez polskich liter — te są w celu. */
const SZUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@';

const OPOZNIENIE_LITERY = 30; // ms — kaskada od lewej
const CZAS_LITERY = 360; // ms szumu na literę (~8 klatek po 45 ms)
const KROK = 45; // ms — podmiana wolniejsza niż odświeżanie, żeby dało się to zobaczyć

/**
 * Nagłówek, który przy wejściu „dosypuje się" do docelowego tekstu.
 *
 * Litera i zaczyna szumieć od razu, a ląduje na swoim miejscu po
 * `i * 30 ms + 360 ms`. Efekt idzie falą od lewej i kończy się sam.
 *
 * Pętla liczy **czas**, nie klatki. Pierwsza wersja zliczała klatki
 * w łańcuchu `setTimeout` → `requestAnimationFrame` i przy podwójnym
 * uruchomieniu efektu w trybie deweloperskim potrafiła zgubić licznik —
 * nagłówek zostawał na losowych znakach na zawsze. Czas płynie niezależnie
 * od tego, ile razy efekt wystartuje.
 *
 * Trzy rzeczy, które muszą być zrobione tak, a nie inaczej:
 *
 * 1. Docelowy tekst siedzi w DOM od pierwszego renderu serwera, w warstwie
 *    dla czytnika ekranu. Animowana jest wyłącznie warstwa z `aria-hidden` —
 *    inaczej czytnik przeczytałby szum, a robot zobaczyłby bełkot zamiast
 *    nagłówka.
 * 2. Spacje nigdy nie są losowane. Podmienianie ich rozbija słowa i przez
 *    pół sekundy nie widać, ile ich w ogóle jest.
 * 3. Sprzątanie zostawia tekst docelowy, nie ostatnią klatkę szumu.
 */
export function TekstDekodujacy({ tekst, className }: { tekst: string; className?: string }) {
  const bezRuchu = useRuchWylaczony();
  const [widoczny, setWidoczny] = useState(tekst);

  useEffect(() => {
    if (bezRuchu) {
      setWidoczny(tekst);
      return;
    }

    const litery = [...tekst];
    const koniec = (litery.length - 1) * OPOZNIENIE_LITERY + CZAS_LITERY;

    const start = performance.now();
    let ramka = 0;
    let ostatniKrok = -1;

    const tick = (teraz: number) => {
      const uplynelo = teraz - start;

      if (uplynelo >= koniec) {
        setWidoczny(tekst);
        return;
      }

      // Podmieniamy najwyżej co `KROK` — bez tego szum miga sześćdziesiąt razy
      // na sekundę i nie da się go przeczytać.
      const krok = Math.floor(uplynelo / KROK);
      if (krok !== ostatniKrok) {
        ostatniKrok = krok;
        setWidoczny(
          litery
            .map((znak, i) => {
              if (znak === ' ') return ' ';
              return uplynelo >= i * OPOZNIENIE_LITERY + CZAS_LITERY
                ? znak
                : SZUM[Math.floor(Math.random() * SZUM.length)];
            })
            .join('')
        );
      }

      ramka = requestAnimationFrame(tick);
    };

    ramka = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(ramka);
      setWidoczny(tekst);
    };
  }, [tekst, bezRuchu]);

  return (
    <span className={className}>
      {/* Prawda dla czytnika i robota — nieanimowana, zawsze pełna. */}
      <span className="sr-only">{tekst}</span>
      <span aria-hidden="true" className="dekoder">
        {widoczny}
      </span>
    </span>
  );
}
