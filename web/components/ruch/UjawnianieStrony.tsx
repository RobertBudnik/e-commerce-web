'use client';

import { useRef } from 'react';
import { useUjawnianie } from '@/lib/ujawnianie';

/**
 * Ujawnianie przy przewijaniu dla całej strony, nie dla jednego kontenera.
 *
 * `useUjawnianie` powstało w `ProductGrid` i obserwuje to, co dostanie w refie.
 * Strona główna jest komponentem serwerowym — nie ma gdzie powiesić refa, więc
 * do tej pory **nie obserwowała niczego**. Skutek był gorszy niż brak animacji:
 * reguła `[data-reveal]` w arkuszu ustawia `opacity: 0` wszystkim, a zdjąć to
 * potrafi wyłącznie obserwator. Prawdziwy towar w sekcji „02 — Wybór" idzie
 * komponentem `ProductCard`, który `data-reveal` nosi — czyli pierwszy produkt
 * dodany do katalogu byłby na stronie głównej **trwale niewidzialny**.
 * Zmierzone w przeglądarce: `opacity: 0`, brak klasy `is-in`, obserwatora zero.
 * Pusty katalog to do tej pory zasłaniał, bo pozycje poglądowe `data-reveal`
 * nie mają.
 *
 * Komponent nic nie rysuje. Wisi na `document.body`, więc łapie wszystko —
 * sekcje strony głównej i kafelki katalogu tym samym obserwatorem.
 */
export function UjawnianieStrony() {
  // Leniwa inicjalizacja zamiast przypisania w efekcie: `useUjawnianie` czyta
  // `.current` w swoim własnym efekcie, a kolejność efektów między
  // komponentem a hakiem nie jest niczym zagwarantowana.
  const korzen = useRef<HTMLElement | null>(null);
  if (korzen.current === null && typeof document !== 'undefined') {
    korzen.current = document.body;
  }

  useUjawnianie(korzen);

  return null;
}
