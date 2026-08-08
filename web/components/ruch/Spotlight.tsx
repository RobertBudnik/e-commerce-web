'use client';

import { useCallback, useRef } from 'react';
import { useEfektKursora } from '@/lib/ruch';

const PROMIEN = 130; // px — wielkość snopa

/**
 * Ciemny panel z tekstem odsłanianym snopem światła za kursorem.
 *
 * Dwie nałożone warstwy tego samego zdania: dolna przygaszona, górna
 * w kolorze akcentowym, przycięta do koła `clip-path` podążającego za myszą.
 *
 * `clip-path` jest w skillu dopuszczony wyłącznie tutaj i wyłącznie za
 * kursorem — nie kompozytuje się tak tanio jak `transform` i `opacity`,
 * więc animowanie go w pętli byłoby marnowaniem klatek na coś, czego nikt
 * nie prowadzi.
 *
 * Tekst jest w dokumencie dwa razy, ale czytnik ekranu dostaje go raz: warstwa
 * górna ma `aria-hidden`. Bez tego panel czytałby się jak zacinająca się płyta.
 *
 * Bez myszy i przy ograniczonym ruchu snop znika, a zostaje sam tekst
 * w normalnym kolorze — panel dalej ma sens, tylko bez zabawy.
 */
export function Spotlight({
  nadtytul,
  tekst,
}: {
  nadtytul: string;
  tekst: string;
}) {
  const aktywny = useEfektKursora();
  const panel = useRef<HTMLElement>(null);
  const snop = useRef<HTMLParagraphElement>(null);

  // `clip-path` składany w JavaScripcie, a nie z `var()` w arkuszu. Podstawienie
  // zmiennej wewnątrz `circle()` nie dochodzi do skutku w każdym silniku —
  // sprawdzone: przy ustawionych `--snop-*` obliczony `clip-path` zostawał na
  // wartościach zapasowych `circle(0px at 50% 50%)`, także po ustawieniu
  // zmiennych wprost na elemencie. Gotowy ciąg nie ma jak się nie podstawić.
  const ruch = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!aktywny) return;
      const node = panel.current;
      const warstwa = snop.current;
      if (!node || !warstwa) return;
      const p = node.getBoundingClientRect();
      warstwa.style.clipPath = `circle(${PROMIEN}px at ${e.clientX - p.left}px ${e.clientY - p.top}px)`;
    },
    [aktywny]
  );

  const wyjscie = useCallback(() => {
    const warstwa = snop.current;
    if (!warstwa) return;
    // Promień do zera zamiast ukrywania warstwy: snop gaśnie w miejscu,
    // w którym stał, zamiast znikać skokiem.
    warstwa.style.clipPath = 'circle(0px at 50% 50%)';
  }, []);

  return (
    <section
      ref={panel}
      className={`spotlight${aktywny ? ' spotlight-zywy' : ''}`}
      onPointerMove={ruch}
      onPointerLeave={wyjscie}
    >
      <div className="container">
        <span className="label">{nadtytul}</span>
        <p className="spotlight-tekst spotlight-spod">{tekst}</p>
        {aktywny && (
          <p ref={snop} className="spotlight-tekst spotlight-snop" aria-hidden="true">
            {tekst}
          </p>
        )}
      </div>
    </section>
  );
}
