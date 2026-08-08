'use client';

import { useEffect, useRef } from 'react';
import { useEfektKursora } from '@/lib/ruch';

const ODSTEP = 34; // px między kropkami
const PROMIEN = 120; // px — zasięg odpychania
const SILA = 0.32; // ile z brakującego dystansu pokonuje kropka na klatkę
const POWROT = 0.08; // ściąganie do pozycji bazowej
const KROPKA = 1.4; // px

type Kropka = { bx: number; by: number; x: number; y: number; vx: number; vy: number };

/**
 * Siatka kropek w tle hero, odpychana kursorem.
 *
 * Canvas, nie tysiąc elementów w DOM: przy odstępie 34 px pełnoekranowy hero
 * to kilkaset punktów, a każdy jako `<span>` z własnym `transform` oznacza
 * kilkaset przeliczeń układu na klatkę.
 *
 * Kolor bierzemy z **obliczonego** stylu elementu-sondy, nie z surowej wartości
 * zmiennej. Tokeny są zapisane w `oklch()` i przez `color-mix()`, a canvas
 * dostaje wtedy ciąg, którego nie zawsze umie odczytać; `getComputedStyle`
 * oddaje kolor już rozwiązany. Przy okazji przełączenie motywu wymaga tylko
 * ponownego odczytu, bez znajomości palety w kodzie.
 *
 * Efekt wymaga myszy i jest wyłączany przy `prefers-reduced-motion` — canvas
 * wtedy w ogóle nie powstaje, więc na telefonie nie ma ani rysowania,
 * ani nasłuchu.
 */
export function PoleCzastek() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const aktywne = useEfektKursora();

  useEffect(() => {
    if (!aktywne) return;
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let kropki: Kropka[] = [];
    let mysz = { x: -9999, y: -9999 };
    let ramka = 0;
    let kolor = 'rgba(0,0,0,.2)';

    const odczytajKolor = () => {
      const sonda = document.createElement('span');
      sonda.style.color = 'var(--line-strong)';
      sonda.style.position = 'absolute';
      sonda.style.opacity = '0';
      el.parentElement?.appendChild(sonda);
      kolor = getComputedStyle(sonda).color;
      sonda.remove();
    };

    const rozmiar = () => {
      const p = el.getBoundingClientRect();
      // Gęstość ekranu ograniczona do 2: przy 3 canvas rośnie dziewięciokrotnie,
      // a kropka o średnicy 1,4 px i tak nie zyskuje na ostrości.
      const gestosc = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.floor(p.width * gestosc);
      el.height = Math.floor(p.height * gestosc);
      ctx.setTransform(gestosc, 0, 0, gestosc, 0, 0);

      kropki = [];
      for (let y = ODSTEP / 2; y < p.height; y += ODSTEP) {
        for (let x = ODSTEP / 2; x < p.width; x += ODSTEP) {
          kropki.push({ bx: x, by: y, x, y, vx: 0, vy: 0 });
        }
      }
    };

    const klatka = () => {
      const p = el.getBoundingClientRect();
      ctx.clearRect(0, 0, p.width, p.height);
      ctx.fillStyle = kolor;

      for (const k of kropki) {
        const dx = k.x - mysz.x;
        const dy = k.y - mysz.y;
        const dist = Math.hypot(dx, dy);

        if (dist < PROMIEN && dist > 0.01) {
          // Im bliżej kursora, tym mocniejsze odepchnięcie — liniowo,
          // bo odwrotność kwadratu przy zerze wystrzeliwuje kropkę w kosmos.
          const moc = ((PROMIEN - dist) / PROMIEN) * SILA;
          k.vx += (dx / dist) * moc * 14;
          k.vy += (dy / dist) * moc * 14;
        }

        k.vx += (k.bx - k.x) * POWROT;
        k.vy += (k.by - k.y) * POWROT;
        // Tłumienie: bez niego kropka drga wokół pozycji bazowej bez końca.
        k.vx *= 0.82;
        k.vy *= 0.82;
        k.x += k.vx;
        k.y += k.vy;

        ctx.beginPath();
        ctx.arc(k.x, k.y, KROPKA, 0, Math.PI * 2);
        ctx.fill();
      }

      ramka = requestAnimationFrame(klatka);
    };

    const naRuch = (e: PointerEvent) => {
      const p = el.getBoundingClientRect();
      mysz = { x: e.clientX - p.left, y: e.clientY - p.top };
    };
    const naWyjscie = () => {
      mysz = { x: -9999, y: -9999 };
    };

    odczytajKolor();
    rozmiar();
    ramka = requestAnimationFrame(klatka);

    const obserwator = new ResizeObserver(rozmiar);
    if (el.parentElement) obserwator.observe(el.parentElement);

    window.addEventListener('pointermove', naRuch, { passive: true });
    window.addEventListener('pointerleave', naWyjscie);
    // Zmiana motywu przemalowuje kropki bez przeładowania strony.
    const motyw = new MutationObserver(odczytajKolor);
    motyw.observe(document.documentElement, { attributeFilter: ['class'] });

    return () => {
      cancelAnimationFrame(ramka);
      obserwator.disconnect();
      motyw.disconnect();
      window.removeEventListener('pointermove', naRuch);
      window.removeEventListener('pointerleave', naWyjscie);
    };
  }, [aktywne]);

  if (!aktywne) return null;

  return <canvas ref={canvas} className="pole-czastek" aria-hidden="true" />;
}
