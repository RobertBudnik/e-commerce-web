'use client';

import { useCallback, useEffect, useRef } from 'react';
import { animate } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';
import { useUjawnianie } from '@/lib/ujawnianie';

const PROG_PRZECIAGNIECIA = 4; // px — powyżej tego to przeciąganie, nie klik

/**
 * Pozioma lista przeciągana myszą lub palcem, z bezwładnością.
 *
 * Bez autoprzewijania — produkt nigdy nie ucieka sam z pola widzenia.
 * Strzępka rusza się wyłącznie wtedy, gdy ktoś ją pchnie, i zwalnia, gdy puści.
 *
 * Wybieg po puszczeniu liczy Motion (`type: 'inertia'`), nie własna pętla.
 * Wcześniej stało tu mnożenie prędkości przez 0,94 na klatkę — wynik zależał
 * od tego, ile klatek zdąży się wyrenderować, więc na słabszym sprzęcie lista
 * hamowała inaczej niż na mocnym. Bezwładność Motion jest liczona z czasu,
 * a nie z klatek, i sama odbija się od krawędzi zamiast ścinać prędkość
 * do zera.
 *
 * Natywne przewijanie zostaje pod spodem: animujemy `scrollLeft`, a nie
 * `transform`. Dzięki temu kółko myszy, trackpad, klawiatura i czytnik ekranu
 * działają tak samo jak przed dołożeniem biblioteki — a przy wyłączonym ruchu
 * zostaje samo przewijanie, bez wybiegu.
 */
export function StrzepkaPrzeciagana({ children }: { children: React.ReactNode }) {
  const bezRuchu = useRuchWylaczony();
  const tor = useRef<HTMLDivElement>(null);
  const stan = useRef({ ciagnie: false, startX: 0, startScroll: 0, ostatniX: 0, ostatniCzas: 0, predkosc: 0, przesuniete: 0 });
  const wybieg = useRef<ReturnType<typeof animate> | null>(null);

  // Kafelki startują z `opacity: 0` i odsłania je dopiero obserwator. Bez tego
  // wywołania strzępka pokazywała pustą przestrzeń zamiast produktów.
  useUjawnianie(tor);

  const zatrzymaj = useCallback(() => {
    wybieg.current?.stop();
    wybieg.current = null;
  }, []);

  const start = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const node = tor.current;
      if (!node) return;

      zatrzymaj();
      stan.current = {
        ciagnie: true,
        startX: e.clientX,
        startScroll: node.scrollLeft,
        ostatniX: e.clientX,
        ostatniCzas: performance.now(),
        predkosc: 0,
        przesuniete: 0,
      };
      node.setPointerCapture(e.pointerId);
      node.classList.add('ciagnie');
    },
    [zatrzymaj]
  );

  const ruch = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const node = tor.current;
    const s = stan.current;
    if (!node || !s.ciagnie) return;

    const delta = e.clientX - s.startX;
    s.przesuniete = Math.max(s.przesuniete, Math.abs(delta));
    node.scrollLeft = s.startScroll - delta;

    // Prędkość w pikselach na sekundę. Zegar bierzemy z `performance.now()`,
    // nie ze znacznika zdarzenia: przy zdarzeniach syntetycznych (testy,
    // narzędzia dostępności) kilka `pointermove` potrafi mieć ten sam
    // znacznik, różnica wychodzi zerowa i pęd nigdy nie powstaje.
    const teraz = performance.now();
    const dt = teraz - s.ostatniCzas;
    const przebyte = e.clientX - s.ostatniX;
    // Poniżej jednej klatki nie ma z czego liczyć — zostawiamy poprzedni
    // pomiar zamiast dzielić przez ułamek milisekundy i dostawać tysiące.
    if (dt >= 8) {
      s.predkosc = (przebyte / dt) * 1000;
      s.ostatniX = e.clientX;
      s.ostatniCzas = teraz;
    } else if (przebyte !== 0 && s.predkosc === 0) {
      // Pierwszy ruch w serii szybszej niż klatka: licz po klatce ekranu,
      // żeby gest krótszy niż 8 ms też miał jakąś prędkość.
      s.predkosc = (przebyte / 16) * 1000;
    }
  }, []);

  const koniec = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const node = tor.current;
      const s = stan.current;
      if (!node || !s.ciagnie) return;

      s.ciagnie = false;
      node.classList.remove('ciagnie');
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);

      // Próg celowo niski. Przeglądarka scala zdarzenia wskaźnika, więc przy
      // szybkim machnięciu do handlera dociera czasem jeden `pointermove`
      // z całą drogą i prędkość wychodzi kilkadziesiąt px/s zamiast tysięcy.
      // Odcinanie na wyższej wartości gubiło wybieg przy prawdziwych gestach
      // tak samo jak w testach; dwadzieścia px/s to już rzut, a nie odłożenie
      // palca.
      if (bezRuchu || Math.abs(s.predkosc) < 20) return;

      const maks = Math.max(0, node.scrollWidth - node.clientWidth);
      // Ręka idzie w prawo, zawartość w lewo — stąd znak przeciwny.
      const predkosc = -s.predkosc;
      const MOC = 0.7;

      // Cel podajemy wprost, choć generator bezwładności policzyłby go tak samo
      // (`origin + power × velocity`). Powód jest prozaiczny: przy identycznym
      // początku i końcu animacja zostaje uznana za „nic się nie zmienia"
      // i skrócona do zera klatek — wybieg nie ruszał w ogóle.
      const cel = node.scrollLeft + MOC * predkosc;

      wybieg.current = animate(node.scrollLeft, cel, {
        type: 'inertia',
        velocity: predkosc,
        power: MOC,
        timeConstant: 420,
        min: 0,
        max: maks,
        bounceStiffness: 300,
        bounceDamping: 40,
        onUpdate: (v: number) => {
          node.scrollLeft = v;
        },
      });
    },
    [bezRuchu]
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

  useEffect(() => zatrzymaj, [zatrzymaj]);

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
