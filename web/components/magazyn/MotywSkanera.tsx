'use client';

import { useEffect, useState } from 'react';

export type Motyw = 'system' | 'ciemny' | 'jasny';

const KLUCZ = 'nordo-skaner-motyw';

const OPCJE: { wartosc: Motyw; etykieta: string }[] = [
  { wartosc: 'system', etykieta: 'Auto' },
  { wartosc: 'jasny', etykieta: 'Jasny' },
  { wartosc: 'ciemny', etykieta: 'Ciemny' },
];

/**
 * Wybór motywu samego skanera.
 *
 * Osobno od motywu aplikacji, bo to inne zadanie dla oczu: kadr z kamery
 * czyta się najlepiej na ciemnym tle niezależnie od tego, jak ustawiony
 * jest telefon, ale w magazynie zalanym słońcem ciemny ekran bywa lustrem.
 * Wybór zostaje przy magazynierze, nie przy nas.
 *
 * Zapis w `localStorage`, nie w bazie: dotyczy tego telefonu i tego światła
 * w hali, a nie konta — ta sama osoba na innej zmianie może chcieć inaczej.
 */
export function useMotywSkanera(): [Motyw, (m: Motyw) => void] {
  const [motyw, setMotyw] = useState<Motyw>('system');

  useEffect(() => {
    try {
      const zapis = localStorage.getItem(KLUCZ);
      if (zapis === 'ciemny' || zapis === 'jasny' || zapis === 'system') setMotyw(zapis);
    } catch {
      // Prywatne okno albo zablokowane magazynowanie — zostaje ustawienie
      // systemu, czyli dokładnie to, co było przed tym przełącznikiem.
    }
  }, []);

  function zapisz(m: Motyw) {
    setMotyw(m);
    try {
      localStorage.setItem(KLUCZ, m);
    } catch {
      /* jak wyżej */
    }
  }

  return [motyw, zapisz];
}

/** Klasa nakładana na kontener skanera. Pusta przy wyborze „Auto". */
export function klasaMotywu(motyw: Motyw): string {
  if (motyw === 'ciemny') return ' motyw-ciemny';
  if (motyw === 'jasny') return ' motyw-jasny';
  return '';
}

export function PrzelacznikMotywu({
  motyw,
  onZmiana,
}: {
  motyw: Motyw;
  onZmiana: (m: Motyw) => void;
}) {
  return (
    <div className="mag-segmenty mag-segmenty-waskie" role="tablist" aria-label="Motyw skanera">
      {OPCJE.map((o) => (
        <button
          key={o.wartosc}
          type="button"
          role="tab"
          className="mag-segment"
          aria-selected={motyw === o.wartosc}
          onClick={() => onZmiana(o.wartosc)}
        >
          {o.etykieta}
        </button>
      ))}
    </div>
  );
}
