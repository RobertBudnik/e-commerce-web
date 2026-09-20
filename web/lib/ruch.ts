'use client';

import { useEffect, useState } from 'react';

/**
 * Wspólny fundament efektów ruchu. Reguły — czasy, krzywe, co wolno animować
 * — stoją w `.claude/skills/ruch-i-animacje`.
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

/* Pętla `animuj` i `easeOutCubic` mieszkały tutaj do czasu wejścia Motion.
   Zostały skasowane, a nie zostawione „na wszelki wypadek": dwa sposoby
   animowania w jednym repo znaczą, że przy każdej kolejnej zmianie trzeba
   zgadywać, którym się animuje. Odliczanie liczb robi teraz `animate`
   z Motion — liczy z czasu, nie z klatek, i samo sprząta po odmontowaniu. */

