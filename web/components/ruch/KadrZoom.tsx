'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Kadr hero, który rośnie przy przewijaniu.
 *
 * Odpowiednik „Scroll Zoom Hero" z katalogu Motion. Tamten przykład jest
 * płatny (Motion+), ale stoi na trzech publicznych API — `useScroll`,
 * `useTransform` i komponencie `motion` — więc zamiast przepisywać cudzy kod
 * budujemy to samo zachowanie u siebie.
 *
 * Postęp liczony jest wzdłuż samego hero: `offset` startuje, gdy górna
 * krawędź sekcji dotyka górnej krawędzi okna, a kończy, gdy dolna krawędź
 * sekcji wychodzi górą. Dzięki temu ruch trwa dokładnie tyle, ile hero jest
 * na ekranie, i nie zależy od tego, jak długa jest reszta strony.
 *
 * Zoom idzie do 1.18, nie dalej: przy większych wartościach zdjęcie traci
 * ostrość na wysokich ekranach, a i tak nikt nie ogląda hero dłużej niż
 * jeden ruch kółkiem. Równolegle kadr gaśnie do 0,55 — treść nad nim zostaje
 * czytelna, kiedy sekcja schodzi z ekranu.
 */
export function KadrZoom({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const bezRuchu = useRuchWylaczony();
  const kotwica = useRef<HTMLDivElement>(null);

  // Hook musi wykonać się bezwarunkowo — React nie pozwala pominąć wywołania
  // przy wyłączonym ruchu. Wyłączamy dopiero to, co z niego wychodzi.
  const { scrollYProgress } = useScroll({
    target: kotwica,
    offset: ['start start', 'end start'],
  });

  const skala = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const przejrzystosc = useTransform(scrollYProgress, [0, 0.85], [1, 0.55]);

  // Mierzymy zewnętrzny element, a skalujemy wewnętrzny. Gdyby ref siedział
  // na tym samym węźle co transformacja, `useScroll` czytałby prostokąt już
  // powiększony i postęp napędzałby sam siebie.
  return (
    <div ref={kotwica} className={className}>
      {bezRuchu ? (
        <div className="kadr-zoom-warstwa">{children}</div>
      ) : (
        <motion.div
          className="kadr-zoom-warstwa"
          style={{ scale: skala, opacity: przejrzystosc }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
