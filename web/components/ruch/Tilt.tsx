'use client';

import { useCallback, useRef } from 'react';
import { useEfektKursora } from '@/lib/ruch';

const KAT = 8; // stopni w każdą stronę

/**
 * Przechył karty pod kursorem.
 *
 * Kąt liczony z położenia kursora względem środka karty: kursor przy górnej
 * krawędzi odchyla kartę do tyłu, przy prawej — w prawo. Maksimum ±8 stopni,
 * czyli tyle, żeby było widać głębię, a nie żeby czytać tekst pod kątem.
 *
 * Obrót idzie osobną właściwością `rotate`, nie zbiorczym `transform` —
 * karta ma już uniesienie na hover, a zbiorczy `transform` skasowałby jedno
 * drugim. To ta sama zasada, którą skill opisuje przy ujawnianiu kafelków.
 *
 * Perspektywa siedzi na rodzicu, nie na karcie: przy `perspective` na samym
 * elemencie każdy kafelek ma własny punkt zbiegu i siatka wygląda jak zbiór
 * niezależnych pudełek zamiast jednej płaszczyzny.
 *
 * Wyłączony bez myszy i przy `prefers-reduced-motion` — na dotyku nie ma
 * czego śledzić, a przechył pod palcem tylko przeszkadza w trafieniu w kartę.
 *
 * Opakowanie stoi **zawsze**, także gdy efekt jest wyłączony. Wcześniej przy
 * braku myszy komponent oddawał same dzieci i dokładał `<div>` dopiero po
 * zamontowaniu, gdy zapytanie medialne odpowiedziało — React niszczył wtedy
 * kafelki i tworzył je od nowa. Obserwator ujawniania zdążył obserwować te
 * pierwsze, nowych nie widział nikt i cała siatka zostawała na `opacity: 0`.
 * Kafelków nie było widać w ogóle. Bez efektu `--tilt-*` są zerowe, więc pusty
 * kontener nic nie kosztuje.
 */
export function Tilt({ children, id }: { children: React.ReactNode; id?: string }) {
  const aktywny = useEfektKursora();
  const element = useRef<HTMLDivElement>(null);

  const ruch = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!aktywny) return;
      const node = element.current;
      if (!node) return;

      const p = node.getBoundingClientRect();
      const x = (e.clientX - p.left) / p.width - 0.5;
      const y = (e.clientY - p.top) / p.height - 0.5;

      // Oś X obraca wokół poziomu, więc bierze pionowe położenie kursora
      // ze znakiem minus: kursor u góry ma odchylić kartę od nas.
      node.style.setProperty('--tilt-x', `${(-y * KAT * 2).toFixed(2)}deg`);
      node.style.setProperty('--tilt-y', `${(x * KAT * 2).toFixed(2)}deg`);
    },
    [aktywny]
  );

  const powrot = useCallback(() => {
    const node = element.current;
    if (!node) return;
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
  }, []);

  return (
    <div
      className="tilt"
      ref={element}
      /* Znacznik dla FLIP-a w siatce. Siedzi tutaj, a nie na dodatkowym
         opakowaniu, bo to ten `div` jest polem siatki i jego pozycję
         mierzy przelot kafli po zmianie filtra. */
      data-flip={id}
      onPointerMove={aktywny ? ruch : undefined}
      onPointerLeave={aktywny ? powrot : undefined}
    >
      {children}
    </div>
  );
}
