'use client';

import { useEffect, useRef } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

const PROG = 120; // px — poniżej tego nagłówek zostaje, żeby nie migał przy górze

/**
 * Nagłówek chowa się przy przewijaniu w dół, wraca przy pierwszym ruchu w górę.
 *
 * Odpowiednik „Scroll Direction: Hide Header" z katalogu Motion. Sens jest
 * praktyczny, nie ozdobny: na karcie produktu i w katalogu treść wygrywa
 * z nawigacją, a nawigacja i tak wraca w chwili, gdy ktoś jej poszuka —
 * czyli wtedy, gdy zacznie przewijać do góry.
 *
 * Klasę wpisujemy prosto do `<html>`, bo pasek jest `position: sticky`
 * w layoucie serwerowym i nie chcemy przez to przeciągać stanu przez Reacta.
 */
export function NaglowekChowany() {
  const bezRuchu = useRuchWylaczony();
  const poprzedni = useRef(0);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => {
    if (bezRuchu) return;

    const wDol = y > poprzedni.current;
    const daleko = y > PROG;
    poprzedni.current = y;

    document.documentElement.classList.toggle('naglowek-schowany', wDol && daleko);
  });

  // Przy wyłączonym ruchu i przy odmontowaniu klasa nie może zostać —
  // inaczej nagłówek zniknąłby na dobre.
  useEffect(() => {
    if (bezRuchu) document.documentElement.classList.remove('naglowek-schowany');
    return () => document.documentElement.classList.remove('naglowek-schowany');
  }, [bezRuchu]);

  return null;
}
