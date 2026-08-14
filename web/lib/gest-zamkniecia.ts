'use client';

import { useEffect, type RefObject } from 'react';
import { animate } from 'motion/react';
import { useRuchWylaczony } from './ruch';

const PROG_DROGI = 90; // px — tyle wystarczy, żeby uznać gest za zamknięcie
const PROG_PREDKOSCI = 400; // px/s — szybki rzut zamyka nawet z bliska

/**
 * Zamykanie szuflady gestem — przeciągnięcie w prawo odsuwa panel, a puszczenie
 * albo domyka go, albo odbija z powrotem.
 *
 * Odpowiednik „Sheet modal" z katalogu Motion, przycięty do naszej szuflady:
 * nie przejmujemy otwierania (to dalej CSS z klasą `is-open`), tylko dokładamy
 * gest. Dzięki temu nie ruszamy ani pułapki fokusu, ani obsługi Escape, ani
 * renderu serwerowego — a na telefonie szuflada zaczyna zachowywać się tak,
 * jak człowiek się spodziewa.
 *
 * Dwa progi zamiast jednego: sama droga karze powolne, ostrożne gesty,
 * a sama prędkość zamyka przy każdym drgnięciu. Razem czytają intencję.
 *
 * Gest łapiemy tylko na dotyku. Przy myszy przeciąganie panelu nie jest
 * niczyim odruchem, a odbierałoby zaznaczanie tekstu w koszyku.
 */
export function useGestZamkniecia(
  panel: RefObject<HTMLElement | null>,
  otwarta: boolean,
  zamknij: () => void
) {
  const bezRuchu = useRuchWylaczony();

  useEffect(() => {
    const node = panel.current;
    if (!node || !otwarta) return;

    let ciagnie = false;
    let startX = 0;
    let ostatniX = 0;
    let ostatniCzas = 0;
    let predkosc = 0;
    let biezaca: ReturnType<typeof animate> | null = null;

    const start = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      // Wewnątrz pól i przycisków gest nie startuje — tam palec ma swoje zadania.
      if ((e.target as HTMLElement)?.closest('input, select, textarea, button, a')) return;

      biezaca?.stop();
      ciagnie = true;
      startX = ostatniX = e.clientX;
      ostatniCzas = performance.now();
      predkosc = 0;
    };

    const ruch = (e: PointerEvent) => {
      if (!ciagnie) return;
      const droga = Math.max(0, e.clientX - startX);
      node.style.transform = `translateX(${droga}px)`;

      const teraz = performance.now();
      const dt = teraz - ostatniCzas;
      if (dt >= 8) {
        predkosc = ((e.clientX - ostatniX) / dt) * 1000;
        ostatniX = e.clientX;
        ostatniCzas = teraz;
      }
    };

    const koniec = (e: PointerEvent) => {
      if (!ciagnie) return;
      ciagnie = false;

      const droga = Math.max(0, e.clientX - startX);
      const zamykamy = droga > PROG_DROGI || predkosc > PROG_PREDKOSCI;

      if (zamykamy) {
        // Domknięcie zostawiamy CSS-owi: kasujemy transform i wołamy `zamknij`,
        // żeby stan aplikacji i animacja nie opowiadały dwóch różnych historii.
        node.style.transform = '';
        zamknij();
        return;
      }

      if (bezRuchu) {
        node.style.transform = '';
        return;
      }

      // Odbicie z powrotem sprężyną — szuflada ma wrócić z ciężarem, nie skokiem.
      biezaca = animate(droga, 0, {
        type: 'spring',
        stiffness: 420,
        damping: 38,
        onUpdate: (v: number) => {
          node.style.transform = `translateX(${v}px)`;
        },
        onComplete: () => {
          node.style.transform = '';
        },
      });
    };

    node.addEventListener('pointerdown', start, { passive: true });
    node.addEventListener('pointermove', ruch, { passive: true });
    node.addEventListener('pointerup', koniec);
    node.addEventListener('pointercancel', koniec);

    return () => {
      biezaca?.stop();
      node.style.transform = '';
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('pointermove', ruch);
      node.removeEventListener('pointerup', koniec);
      node.removeEventListener('pointercancel', koniec);
    };
  }, [panel, otwarta, zamknij, bezRuchu]);
}
