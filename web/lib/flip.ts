'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { useRuchWylaczony } from './ruch';

/**
 * Przelot elementów na nowe pozycje po zmianie listy — technika FLIP.
 *
 * Bez tego zmiana filtra w katalogu przestawia kafle skokiem i nie widać,
 * które zostały, a które doszły. Z tym kafel, który przetrwał filtrowanie,
 * przelatuje na nowe miejsce, a oko ma za czym podążyć. To ruch niosący
 * informację, nie ozdobę: odpowiada na pytanie „gdzie się podziało to,
 * co przed chwilą oglądałem".
 *
 * Zasada: mierzymy pozycje przed zmianą i po niej, ustawiamy element z powrotem
 * tam, gdzie był (`translate`), i puszczamy do zera. Przeglądarka animuje samą
 * kompozycję, bo `transform` nie dotyka układu — dlatego przelot dwudziestu
 * kafli kosztuje tyle co jednego.
 *
 * Elementy oznacza się atrybutem `data-flip` z trwałym identyfikatorem.
 * Trwałym, bo po nim rozpoznajemy, że to ten sam kafel; indeks w liście
 * zmienia się przy każdym filtrowaniu i przelot wyszedłby wtedy na opak.
 */
/**
 * Ostatnio zmierzone pozycje, poza cyklem życia komponentu.
 *
 * Filtrowanie katalogu idzie przez adres, a Next przy takiej nawigacji potrafi
 * odmontować i zamontować siatkę od nowa. Pamięć trzymana w `useRef` startowała
 * wtedy pusta i nie było od czego liczyć przelotu — kafle przeskakiwały tak
 * samo jak przed zmianą, tylko z martwym kodem obok.
 *
 * Pozycje trzymamy w układzie dokumentu, nie okna. `getBoundingClientRect`
 * liczy od krawędzi widoku, więc samo przewinięcie strony zmieniłoby zapis
 * i kafel przyleciałby z miejsca, w którym nigdy nie był. Po dodaniu przesunięcia
 * przewijania zapis opisuje położenie na stronie i przeżywa i scroll, i czas —
 * dzięki temu nie potrzeba krótkiego okna ważności, które wcześniej kasowało
 * przelot każdemu, kto oglądał katalog dłużej niż sekundę.
 */
const OSTATNIE = new Map<string, { x: number; y: number }>();

export function useFlip(kontener: RefObject<HTMLElement | null>, zaleznosc: unknown) {
  const bezRuchu = useRuchWylaczony();

  // `useLayoutEffect`, nie `useEffect`: pomiar i cofnięcie muszą się zmieścić
  // przed odmalowaniem. W `useEffect` przeglądarka zdąży pokazać kafle już
  // na nowych miejscach i zamiast przelotu zobaczymy przeskok, a potem drugi.
  useLayoutEffect(() => {
    const root = kontener.current;
    if (!root) return;

    const elementy = [...root.querySelectorAll<HTMLElement>('[data-flip]')];

    for (const el of elementy) {
      const id = el.dataset.flip;
      if (!id) continue;

      const pudlo = el.getBoundingClientRect();
      const x = pudlo.left + window.scrollX;
      const y = pudlo.top + window.scrollY;

      const przed = OSTATNIE.get(id);
      OSTATNIE.set(id, { x, y });

      if (!przed || bezRuchu) continue;

      const dx = przed.x - x;
      const dy = przed.y - y;
      // Poniżej piksela nie ma czego animować, a puszczanie animacji na każdy
      // element przy zmianie szerokości okna kosztuje bez powodu.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      el.animate(
        [
          { transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        { duration: 420, easing: 'cubic-bezier(.2, .7, .3, 1)' }
      );
    }
  }, [zaleznosc, bezRuchu, kontener]);
}
