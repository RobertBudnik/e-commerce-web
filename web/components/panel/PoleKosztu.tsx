'use client';

import { useState, useTransition } from 'react';
import { zapiszKosztAction } from '@/app/actions/panel';

/**
 * Koszt zakupu jednej pozycji. Zapis po opuszczeniu pola, nie przyciskiem —
 * właściciel wpisuje kilkanaście kosztów pod rząd i osobne „zapisz" przy
 * każdym wierszu zamieniłoby to w klikanie.
 *
 * Bez zmiany wartości nie ma zapytania: powrót do pola i wyjście z niego to
 * nie jest edycja.
 */
export function PoleKosztu({ produktId, koszt }: { produktId: string; koszt: number | null }) {
  const [wartosc, setWartosc] = useState(koszt === null ? '' : String(koszt));
  const [zapisane, setZapisane] = useState(koszt === null ? '' : String(koszt));
  const [blad, setBlad] = useState<string | null>(null);
  const [czekam, start] = useTransition();

  function zapisz() {
    if (wartosc === zapisane) return;

    const liczba = Number(wartosc.replace(',', '.'));
    if (wartosc.trim() === '' || !Number.isFinite(liczba) || liczba < 0) {
      setBlad('Wpisz kwotę w złotych');
      return;
    }

    setBlad(null);
    start(async () => {
      const wynik = await zapiszKosztAction(produktId, liczba);
      if (wynik.ok) setZapisane(String(wynik.dane));
      else setBlad(wynik.blad);
    });
  }

  return (
    <span className="pw-pole-koszt">
      <input
        className="pw-input num"
        inputMode="decimal"
        aria-label="Koszt zakupu w złotych"
        value={wartosc}
        placeholder="—"
        disabled={czekam}
        onChange={(e) => setWartosc(e.target.value)}
        onBlur={zapisz}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {blad && (
        <span className="pw-blad" role="status">
          {blad}
        </span>
      )}
    </span>
  );
}
