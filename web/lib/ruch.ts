'use client';

import { useEffect, useState } from 'react';

/**
 * Wspólny fundament efektów z sekcji „Zaawansowany ruch" w `nordo-design`.
 *
 * Dwa pytania, które zadaje każdy z nich, i dwie odpowiedzi, które muszą być
 * liczone tak samo wszędzie — inaczej jeden efekt wyłączy się przy
 * `prefers-reduced-motion`, a drugi zostanie i cała deklaracja jest nic niewarta.
 */

/** Zapytania mediów czytane po stronie przeglądarki, z nasłuchem na zmianę. */
function useZapytanie(zapytanie: string, domyslnie: boolean): boolean {
  // Serwer nie zna kursora ani ustawień dostępności. Zaczynamy od wartości
  // bezpiecznej dla danego efektu, a prawdę ustalamy po zamontowaniu — dzięki
  // temu pierwszy render serwera i klienta są zgodne i nie ma ostrzeżenia
  // o rozjechanej hydratacji.
  const [wynik, setWynik] = useState(domyslnie);

  useEffect(() => {
    const media = matchMedia(zapytanie);
    setWynik(media.matches);

    const nasluch = (e: MediaQueryListEvent) => setWynik(e.matches);
    media.addEventListener('change', nasluch);
    return () => media.removeEventListener('change', nasluch);
  }, [zapytanie]);

  return wynik;
}

/**
 * Czy ruch ma być wyłączony.
 *
 * Domyślnie `true`: zanim przeglądarka odpowie, zakładamy, że użytkownik
 * ruchu nie chce. Efekt włączy się po zamontowaniu, jeśli wolno — odwrotna
 * kolejność oznaczałaby błysk animacji u kogoś, kto ją sobie wyłączył.
 *
 * Globalna reguła w `globals.css` ścina czasy CSS-owe, ale te efekty żyją
 * w JavaScripcie i ona ich nie dosięga.
 */
export function useRuchWylaczony(): boolean {
  return useZapytanie('(prefers-reduced-motion: reduce)', true);
}

/**
 * Czy urządzenie ma prawdziwy kursor.
 *
 * Domyślnie `false`: efekty wymagające myszy mają się nie odpalić na telefonie
 * ani przez ułamek sekundy. `hover: hover` odsiewa dotyk, `pointer: fine`
 * dodatkowo rysiki i pady, które potrafią raportować hover, a nie dają
 * ciągłego położenia kursora.
 */
export function useMysz(): boolean {
  return useZapytanie('(hover: hover) and (pointer: fine)', false);
}

/**
 * Czy efekt kursorowy ma w ogóle działać — skrót na najczęstszy warunek.
 * Tilt, magnes, cząsteczki i podobne efekty pytają dokładnie o to.
 */
export function useEfektKursora(): boolean {
  const mysz = useMysz();
  const bezRuchu = useRuchWylaczony();
  return mysz && !bezRuchu;
}

/** Wygładzenie użyte przez liczniki i odometr — zgodne z tabelą w skillu. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Pętla animacji na `requestAnimationFrame` ze sprzątaniem.
 *
 * Skill wymaga `rAF`, nie `setInterval`, i sprzątania w `useEffect` — efekt,
 * który zostaje po odmontowaniu, to wyciek. Ta funkcja pilnuje obu rzeczy
 * za wszystkie efekty naraz.
 *
 * `krok` dostaje postęp 0…1; zwrócenie `false` kończy pętlę wcześniej.
 */
export function animuj(
  czas: number,
  krok: (postep: number) => void | false
): () => void {
  let klatka = 0;
  const start = performance.now();

  const tick = (teraz: number) => {
    const postep = Math.min(1, (teraz - start) / czas);
    if (krok(postep) === false) return;
    if (postep < 1) klatka = requestAnimationFrame(tick);
  };

  klatka = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(klatka);
}
