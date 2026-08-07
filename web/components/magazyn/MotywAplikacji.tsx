'use client';

import { useEffect, useState } from 'react';

type Motyw = 'system' | 'jasny' | 'ciemny';

/** Ten sam klucz, którego używa skrypt blokujący w layoucie. */
const KLUCZ = 'nordo-theme';

const OPCJE: { wartosc: Motyw; etykieta: string }[] = [
  { wartosc: 'system', etykieta: 'Auto' },
  { wartosc: 'jasny', etykieta: 'Jasny' },
  { wartosc: 'ciemny', etykieta: 'Ciemny' },
];

/**
 * Wybór motywu całej aplikacji magazynowej.
 *
 * W powłoce nagłówek sklepu jest ukryty, a razem z nim przełącznik motywu —
 * do tej pory magazyn szedł wyłącznie za ustawieniem telefonu i nie dało się
 * tego zmienić z aplikacji. W hali bywa to za mało: ten sam telefon rano stoi
 * pod oknem, a wieczorem w regale.
 *
 * Trzy stany, nie dwa. „Auto" kasuje zapis i oddaje decyzję systemowi —
 * dokładnie tak czyta to skrypt blokujący w layoucie i nasłuch zmiany
 * ustawienia: obecny klucz oznacza świadomy wybór i wygrywa, brak klucza
 * oznacza „idź za telefonem".
 *
 * Zapis w `localStorage`, nie w bazie: dotyczy tego urządzenia i tego światła,
 * a nie konta — ta sama osoba na innej zmianie może chcieć inaczej.
 */
export function MotywAplikacji() {
  const [motyw, setMotyw] = useState<Motyw>('system');
  const [gotowy, setGotowy] = useState(false);

  useEffect(() => {
    try {
      const zapis = localStorage.getItem(KLUCZ);
      setMotyw(zapis === 'dark' ? 'ciemny' : zapis === 'light' ? 'jasny' : 'system');
    } catch {
      // Prywatne okno albo zablokowane magazynowanie — zostaje ustawienie
      // systemu, czyli to samo, co przed tym przełącznikiem.
    }
    setGotowy(true);
  }, []);

  function wybierz(m: Motyw) {
    setMotyw(m);

    const ciemny =
      m === 'ciemny' ||
      (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', ciemny);

    try {
      if (m === 'system') localStorage.removeItem(KLUCZ);
      else localStorage.setItem(KLUCZ, m === 'ciemny' ? 'dark' : 'light');
    } catch {
      /* jak wyżej — wybór zadziała do końca sesji */
    }
  }

  return (
    <>
      <h2 className="mag-sekcja">Motyw</h2>
      <div
        className="mag-segmenty mag-segmenty-waskie"
        role="tablist"
        aria-label="Motyw aplikacji"
      >
        {OPCJE.map((o) => (
          <button
            key={o.wartosc}
            type="button"
            role="tab"
            className="mag-segment"
            /* Do pierwszego odczytu z pamięci nie wiemy, co jest wybrane.
               Zgadywanie kończy się mignięciem zaznaczenia na złej opcji. */
            aria-selected={gotowy ? motyw === o.wartosc : false}
            onClick={() => wybierz(o.wartosc)}
          >
            {o.etykieta}
          </button>
        ))}
      </div>
    </>
  );
}
