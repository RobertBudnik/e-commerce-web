'use client';

import { useEffect, useRef } from 'react';
import { useEfektKursora } from '@/lib/ruch';

const DOCIAGANIE = 0.18; // ułamek dystansu pokonywany na klatkę

/** Elementy, nad którymi pierścień rośnie i pokazuje etykietę. */
const KLIKALNE = 'a, button, [role="button"], input, select, textarea, summary, .strzepka';

/**
 * Pierścień podążający za myszą z opóźnieniem.
 *
 * Systemowy kursor znika dopiero wtedy, gdy ten komponent się zamontuje —
 * klasa na `<html>` jest dokładana z JavaScriptu. Gdyby `cursor: none` stało
 * w arkuszu na stałe, awaria skryptu albo wolne łącze zostawiłyby stronę bez
 * żadnego wskaźnika myszy, a to jest usterka, z której użytkownik nie ma
 * wyjścia.
 *
 * Etykieta bierze się z `data-kursor` na elemencie pod spodem, a w drugiej
 * kolejności z jego dostępnej nazwy. Nic nie trzeba oznaczać ręcznie, żeby
 * pierścień zareagował.
 *
 * Efekt chowa się przed dotykiem i przy `prefers-reduced-motion` — na telefonie
 * nie ma kursora do zastąpienia, a opóźniony pierścień to dokładnie ten rodzaj
 * ruchu, którego to ustawienie ma nie pokazywać.
 */
export function WlasnyKursor() {
  const aktywny = useEfektKursora();
  const pierscien = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aktywny) return;
    const node = pierscien.current;
    if (!node) return;

    const korzen = document.documentElement;
    korzen.classList.add('bez-kursora');

    let cel = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const teraz = { ...cel };
    let ramka = 0;
    let widoczny = false;

    const krok = () => {
      teraz.x += (cel.x - teraz.x) * DOCIAGANIE;
      teraz.y += (cel.y - teraz.y) * DOCIAGANIE;
      node.style.transform = `translate3d(${teraz.x}px, ${teraz.y}px, 0) translate(-50%, -50%)`;
      ramka = requestAnimationFrame(krok);
    };

    const naRuch = (e: PointerEvent) => {
      cel = { x: e.clientX, y: e.clientY };

      if (!widoczny) {
        widoczny = true;
        node.classList.add('jest');
      }

      const pod = (e.target as Element | null)?.closest?.(KLIKALNE) ?? null;
      node.classList.toggle('nad-celem', Boolean(pod));

      const etykieta =
        pod?.getAttribute('data-kursor') ??
        (pod?.getAttribute('aria-label') || pod?.textContent?.trim()?.slice(0, 24)) ??
        '';
      node.dataset.etykieta = pod ? etykieta : '';
    };

    const naWyjscie = () => {
      widoczny = false;
      node.classList.remove('jest');
    };

    window.addEventListener('pointermove', naRuch, { passive: true });
    document.addEventListener('pointerleave', naWyjscie);
    ramka = requestAnimationFrame(krok);

    return () => {
      cancelAnimationFrame(ramka);
      window.removeEventListener('pointermove', naRuch);
      document.removeEventListener('pointerleave', naWyjscie);
      korzen.classList.remove('bez-kursora');
    };
  }, [aktywny]);

  if (!aktywny) return null;

  return <div ref={pierscien} className="kursor" aria-hidden="true" />;
}
