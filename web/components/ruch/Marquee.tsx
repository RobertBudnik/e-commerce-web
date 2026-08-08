'use client';

import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Przewijający się poziomo pasek pod nagłówkiem.
 *
 * Skill zakazuje karuzeli z autoprzewijaniem i to zostaje w mocy — ale dotyczy
 * karuzeli **produktów**, w której pozycja sama ucieka z pola widzenia, zanim
 * ktoś zdąży ją kliknąć. Tutaj przewija się tekst: nic nie znika bezpowrotnie,
 * bo pętla wraca, nic nie trzeba złapać w locie, a pod kursorem pasek staje.
 *
 * Szew: treść jest w dokumencie dwa razy, a animacja przesuwa dokładnie
 * o połowę szerokości. Po tym przesunięciu drugi komplet stoi tam, gdzie
 * zaczynał pierwszy — przeskok do zera jest niewidoczny, bo obraz jest ten sam.
 * Duplikat dostaje `aria-hidden`, żeby czytnik ekranu nie przeczytał wszystkiego
 * dwa razy.
 */
export function Marquee({ hasla }: { hasla: string[] }) {
  const bezRuchu = useRuchWylaczony();

  if (hasla.length === 0) return null;

  const komplet = (ukryty: boolean) => (
    <ul className="marquee-lista" aria-hidden={ukryty || undefined}>
      {hasla.map((h, i) => (
        <li key={`${h}-${i}`}>
          {h}
          <span className="marquee-kropka" aria-hidden="true">
            ·
          </span>
        </li>
      ))}
    </ul>
  );

  // Bez ruchu pasek zostaje statyczną listą: jeden komplet, bez duplikatu
  // i bez przewijania. Treść jest ta sama, tylko cała naraz.
  if (bezRuchu) {
    return (
      <div className="marquee marquee-stoi">
        <div className="marquee-tor">{komplet(false)}</div>
      </div>
    );
  }

  return (
    <div className="marquee">
      <div className="marquee-tor">
        {komplet(false)}
        {komplet(true)}
      </div>
    </div>
  );
}
