'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Warstwa jadąca wolniej niż strona.
 *
 * Głębia bierze się z różnicy prędkości, nie z cienia ani z rozmycia: element
 * przesuwany o ułamek drogi przewijania czyta się jako dalszy, bo tak zachowuje
 * się świat za oknem pociągu. Efekt należy do tych „niosących ciężar" —
 * nie informuje o niczym, buduje wrażenie masy.
 *
 * Sila to ułamek drogi. 0.12 jest ledwo wyczuwalne i o to chodzi; powyżej
 * mniej więcej 0.3 warstwa zaczyna wyprzedzać wzrok i zamiast głębi robi się
 * poślizg, po którym widać, że to sztuczka.
 *
 * Liczone wyłącznie na `translate3d`, więc nic nie przelicza układu. Pozycję
 * bierzemy z `getBoundingClientRect` w klatce, nie z nasłuchu na każde
 * zdarzenie przewijania — przy dwóch warstwach na stronie to różnica między
 * płynnością a szarpaniem na słabszym sprzęcie.
 */
export function Paralaksa({
  children,
  sila = 0.12,
  className,
}: {
  children: ReactNode;
  sila?: number;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const bezRuchu = useRuchWylaczony();

  useEffect(() => {
    const el = element.current;
    if (!el || bezRuchu) return;

    let klatka = 0;
    let widoczny = false;

    // Poza kadrem nie ma czego przesuwać, a licząc dalej płacilibyśmy za każdą
    // warstwę na stronie przy każdym przewinięciu.
    const obserwator = new IntersectionObserver(
      ([wpis]) => {
        widoczny = wpis.isIntersecting;
        if (widoczny) zaplanuj();
      },
      { rootMargin: '120px' }
    );
    obserwator.observe(el);

    function przelicz() {
      klatka = 0;
      const e = element.current;
      if (!e) return;

      const pudlo = e.getBoundingClientRect();
      // Odległość środka elementu od środka ekranu — zero w chwili, gdy
      // warstwa mija środek, więc przesunięcie nie kumuluje się przez stronę.
      const odSrodka = pudlo.top + pudlo.height / 2 - window.innerHeight / 2;
      e.style.transform = `translate3d(0, ${(-odSrodka * sila).toFixed(2)}px, 0)`;
    }

    function zaplanuj() {
      if (klatka || !widoczny) return;
      klatka = requestAnimationFrame(przelicz);
    }

    przelicz();
    window.addEventListener('scroll', zaplanuj, { passive: true });
    window.addEventListener('resize', zaplanuj);

    return () => {
      obserwator.disconnect();
      window.removeEventListener('scroll', zaplanuj);
      window.removeEventListener('resize', zaplanuj);
      if (klatka) cancelAnimationFrame(klatka);
      // Bez tego warstwa zostaje przesunięta w miejscu, w którym ją zastano —
      // widać to natychmiast po włączeniu ograniczenia ruchu.
      if (element.current) element.current.style.transform = '';
    };
  }, [sila, bezRuchu]);

  return (
    <div ref={element} className={className}>
      {children}
    </div>
  );
}
