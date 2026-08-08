'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRuchWylaczony } from '@/lib/ruch';
import { useUjawnianie } from '@/lib/ujawnianie';

const TARCIE = 0.94; // ubytek prędkości na klatkę po puszczeniu
const PROG = 0.4; // px/klatkę — poniżej tego zatrzymujemy pętlę
const PROG_PRZECIAGNIECIA = 4; // px — powyżej tego to przeciąganie, nie klik

/**
 * Pozioma lista przeciągana myszą lub palcem, z bezwładnością.
 *
 * Bez autoprzewijania — skill zakazuje karuzeli, w której produkt sam ucieka
 * z pola widzenia. Tu nic nie jedzie samo: strzępka rusza się wyłącznie wtedy,
 * gdy ktoś ją pchnie, i zwalnia, gdy puści.
 *
 * Bezwładność liczona własną pętlą, a nie przez `scroll-behavior: smooth`,
 * bo tamto nie zna prędkości rzutu — puszczenie po szybkim machnięciu i po
 * powolnym przesunięciu dałoby ten sam wynik.
 *
 * Dotyk obsługiwany tak samo jak mysz, i to jedyny z efektów kursorowych,
 * który na telefonie ma sens: przeciąganie palcem jest tam naturalniejsze niż
 * przy myszy. Natywne przewijanie zostaje jako podkład — element ma
 * `overflow-x: auto`, więc bez JavaScriptu i przy wyłączonym ruchu lista
 * dalej się przewija, tylko bez wybiegu.
 */
export function StrzepkaPrzeciagana({ children }: { children: React.ReactNode }) {
  const bezRuchu = useRuchWylaczony();
  const tor = useRef<HTMLDivElement>(null);
  const stan = useRef({ ciagnie: false, startX: 0, startScroll: 0, predkosc: 0, ostatniX: 0, przesuniete: 0 });
  const ramka = useRef(0);

  // Kafelki startują z `opacity: 0` i odsłania je dopiero obserwator. Bez tego
  // wywołania strzępka pokazywała pustą przestrzeń zamiast produktów — reguła
  // CSS ustawia stan początkowy dla wszystkich `[data-reveal]`, więc każdy
  // kontener z kafelkami musi umieć je odsłonić, nie tylko siatka katalogu.
  useUjawnianie(tor);

  const wybieg = useCallback(() => {
    const node = tor.current;
    if (!node) return;

    const krok = () => {
      const s = stan.current;
      s.predkosc *= TARCIE;

      if (Math.abs(s.predkosc) < PROG) return;

      node.scrollLeft -= s.predkosc;

      // Na krawędzi wygaszamy od razu — dalsze mnożenie tylko trzyma pętlę
      // przy życiu, choć lista już nigdzie nie jedzie.
      const koniec = node.scrollWidth - node.clientWidth;
      if (node.scrollLeft <= 0 || node.scrollLeft >= koniec) {
        s.predkosc = 0;
        return;
      }

      ramka.current = requestAnimationFrame(krok);
    };

    cancelAnimationFrame(ramka.current);
    ramka.current = requestAnimationFrame(krok);
  }, []);

  const start = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const node = tor.current;
      if (!node) return;

      cancelAnimationFrame(ramka.current);
      stan.current = {
        ciagnie: true,
        startX: e.clientX,
        startScroll: node.scrollLeft,
        predkosc: 0,
        ostatniX: e.clientX,
        przesuniete: 0,
      };
      node.setPointerCapture(e.pointerId);
      node.classList.add('ciagnie');
    },
    []
  );

  const ruch = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const node = tor.current;
    const s = stan.current;
    if (!node || !s.ciagnie) return;

    const delta = e.clientX - s.startX;
    s.przesuniete = Math.max(s.przesuniete, Math.abs(delta));
    node.scrollLeft = s.startScroll - delta;

    // Prędkość z ostatniej klatki, nie z całego gestu: liczy się to, jak
    // szybko ręka szła w chwili puszczenia, a nie średnia z całej drogi.
    s.predkosc = e.clientX - s.ostatniX;
    s.ostatniX = e.clientX;
  }, []);

  const koniec = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const node = tor.current;
      const s = stan.current;
      if (!node || !s.ciagnie) return;

      s.ciagnie = false;
      node.classList.remove('ciagnie');
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);

      if (!bezRuchu) wybieg();
    },
    [bezRuchu, wybieg]
  );

  // Przeciągnięcie nie może kończyć się otwarciem karty, na której gest się
  // zaczął. Sprawdzamy dystans, nie czas — powolne przeciągnięcie o 200 px
  // to nadal przeciągnięcie.
  const klik = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (stan.current.przesuniete > PROG_PRZECIAGNIECIA) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  useEffect(() => () => cancelAnimationFrame(ramka.current), []);

  return (
    <div
      ref={tor}
      className="strzepka"
      onPointerDown={start}
      onPointerMove={ruch}
      onPointerUp={koniec}
      onPointerCancel={koniec}
      onClickCapture={klik}
    >
      {children}
    </div>
  );
}
