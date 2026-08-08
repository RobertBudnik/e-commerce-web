'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Ujawnianie elementów `[data-reveal]` przy przewijaniu.
 *
 * Wyciągnięte z `ProductGrid`, bo obserwator był tam jedynym miejscem, które
 * potrafiło zdjąć z kafelka `opacity: 0`. Kafelki renderowane poza siatką —
 * na przykład w przeciąganej strzępce na stronie głównej — zostawały przez to
 * niewidzialne na zawsze. Reguła CSS ustawia stan początkowy dla wszystkich,
 * więc odsłanianie też musi być wspólne, a nie przypięte do jednego kontenera.
 *
 * Obserwator siedzi na kontenerze, nie na każdym elemencie: jeden na listę
 * wystarczy, a przy ośmiu kafelkach osiem obserwatorów to osiem razy więcej
 * pracy przy każdym przewinięciu.
 */
export function useUjawnianie(kontener: RefObject<HTMLElement | null>, zaleznosc?: unknown) {
  useEffect(() => {
    const root = kontener.current;
    if (!root) return;

    const cele = root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)');

    // Przy ograniczonym ruchu element ma być widoczny od razu, a nie
    // niewidoczny — to najczęstszy sposób, w jaki ujawnianie psuje stronę.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cele.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (wpisy) => {
        wpisy.forEach((wpis) => {
          if (!wpis.isIntersecting) return;
          // Element wjeżdżający od góry pojawia się bez animacji — animowanie
          // go przy powrocie w górę wygląda jak usterka.
          if (wpis.boundingClientRect.top < 0) wpis.target.classList.add('is-instant');
          wpis.target.classList.add('is-in');
          io.unobserve(wpis.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    cele.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [kontener, zaleznosc]);
}
