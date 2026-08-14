'use client';

import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useSpring, useVelocity } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Ślad kursora — pierścień biegnący za wskaźnikiem z opóźnieniem sprężyny.
 *
 * Dwie warstwy zamiast jednej: punkt trzyma się kursora niemal sztywno,
 * pierścień wlecze się za nim. Dopiero różnica prędkości tych dwóch daje
 * wrażenie ciągnięcia czegoś za sobą; sam pierścień z opóźnieniem wygląda
 * jak zacinający się interfejs.
 *
 * Pierścień rozciąga się w kierunku ruchu proporcjonalnie do prędkości —
 * przy szybkim rzucie myszą robi się smugą, w spoczynku wraca do koła.
 * To ta sama zasada, co w „scroll velocity" z katalogu Motion, tylko liczona
 * z prędkości wskaźnika zamiast przewijania.
 *
 * Nie pokazuje się nigdy przy: dotyku (nie ma czego śledzić), ograniczonym
 * ruchu i na wąskich ekranach. Nie przejmuje też systemowego kursora —
 * strzałka zostaje tam, gdzie była, bo sklep, w którym ludzie wydają
 * pieniądze, nie jest miejscem na eksperymenty ze wskaźnikiem.
 */
export function SladKursora() {
  const bezRuchu = useRuchWylaczony();
  const punkt = useRef<HTMLDivElement>(null);
  const pierscien = useRef<HTMLDivElement>(null);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  // Punkt niemal bez opóźnienia, pierścień miękko — stąd dwie różne sprężyny.
  const punktX = useSpring(x, { stiffness: 900, damping: 60, mass: 0.2 });
  const punktY = useSpring(y, { stiffness: 900, damping: 60, mass: 0.2 });
  const kolkoX = useSpring(x, { stiffness: 170, damping: 22, mass: 0.6 });
  const kolkoY = useSpring(y, { stiffness: 170, damping: 22, mass: 0.6 });

  const predkoscX = useVelocity(kolkoX);
  const predkoscY = useVelocity(kolkoY);

  useEffect(() => {
    if (bezRuchu) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const ruch = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };

    // Pierwszy ruch odsłania ślad — do tego czasu nic nie wisi w rogu ekranu.
    const odsloń = () => {
      punkt.current?.setAttribute('data-widoczny', 'tak');
      pierscien.current?.setAttribute('data-widoczny', 'tak');
    };

    const schowaj = () => {
      punkt.current?.removeAttribute('data-widoczny');
      pierscien.current?.removeAttribute('data-widoczny');
    };

    window.addEventListener('pointermove', ruch, { passive: true });
    window.addEventListener('pointermove', odsloń, { once: true, passive: true });
    document.addEventListener('pointerleave', schowaj);

    return () => {
      window.removeEventListener('pointermove', ruch);
      window.removeEventListener('pointermove', odsloń);
      document.removeEventListener('pointerleave', schowaj);
    };
  }, [bezRuchu, x, y]);

  // Rozciągnięcie w kierunku ruchu. Liczymy w jednym miejscu i piszemy prosto
  // do stylu, żeby nie renderować Reactem sześćdziesiąt razy na sekundę.
  useEffect(() => {
    if (bezRuchu) return;
    const node = pierscien.current;
    if (!node) return;

    const przelicz = () => {
      const vx = predkoscX.get();
      const vy = predkoscY.get();
      const szybkosc = Math.min(1, Math.hypot(vx, vy) / 2600);
      const kat = (Math.atan2(vy, vx) * 180) / Math.PI;
      node.style.rotate = `${kat}deg`;
      node.style.scale = `${1 + szybkosc * 0.9} ${1 - szybkosc * 0.35}`;
    };

    const stopX = predkoscX.on('change', przelicz);
    const stopY = predkoscY.on('change', przelicz);
    return () => {
      stopX();
      stopY();
    };
  }, [bezRuchu, predkoscX, predkoscY]);

  // Pozycje piszemy prosto do transformu — te same powody co wyżej.
  useEffect(() => {
    if (bezRuchu) return;
    const pisz = (mv: typeof punktX, node: () => HTMLElement | null, os: 'left' | 'top') =>
      mv.on('change', (v) => {
        const el = node();
        if (el) el.style[os] = `${v}px`;
      });

    const stopy = [
      pisz(punktX, () => punkt.current, 'left'),
      pisz(punktY, () => punkt.current, 'top'),
      pisz(kolkoX, () => pierscien.current, 'left'),
      pisz(kolkoY, () => pierscien.current, 'top'),
    ];
    return () => stopy.forEach((s) => s());
  }, [bezRuchu, punktX, punktY, kolkoX, kolkoY]);

  // Pierścień puchnie nad elementami klikalnymi — sygnał „tu coś się stanie".
  useEffect(() => {
    if (bezRuchu) return;
    const node = pierscien.current;
    if (!node) return;

    const nad = (e: PointerEvent) => {
      const cel = e.target as HTMLElement | null;
      const klikalne = cel?.closest('a, button, [role="button"], input, select');
      animate(node, { width: klikalne ? 56 : 30, height: klikalne ? 56 : 30 }, { duration: 0.22 });
    };

    window.addEventListener('pointerover', nad, { passive: true });
    return () => window.removeEventListener('pointerover', nad);
  }, [bezRuchu]);

  if (bezRuchu) return null;

  return (
    <>
      <div ref={pierscien} className="slad-pierscien" aria-hidden="true" />
      <div ref={punkt} className="slad-punkt" aria-hidden="true" />
    </>
  );
}
