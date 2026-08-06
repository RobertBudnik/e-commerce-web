'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  nadajPrzesylkeAction,
  ustawStanZamowieniaAction,
} from '@/app/actions/magazyn';

type Props = {
  zamowienieId: string;
  stan: string;
  numerPrzesylki: string | null;
};

/**
 * Dolne akcje karty zamówienia.
 *
 * Numer przesyłki wpisuje się tutaj, a nie na osobnym ekranie: magazynier
 * ma go już na etykiecie z drukarki, więc jedno pole i jeden przycisk to
 * cała droga. Po nadaniu zamówienie zmienia zakładkę i znika z kolejki
 * „Nowe" — odświeżenie trasy robi to bez przeładowania strony.
 */
export function AkcjeZamowienia({ zamowienieId, stan, numerPrzesylki }: Props) {
  const router = useRouter();
  const [numer, setNumer] = useState('');
  const [wToku, setWToku] = useState<'przesylka' | 'spakowane' | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const wyslane = Boolean(numerPrzesylki);

  async function nadaj() {
    setBlad(null);
    setWToku('przesylka');
    const wynik = await nadajPrzesylkeAction(zamowienieId, numer);
    setWToku(null);

    if (!wynik.ok) {
      setBlad(wynik.blad);
      return;
    }
    router.refresh();
  }

  async function oznacz() {
    setBlad(null);
    setWToku('spakowane');
    const wynik = await ustawStanZamowieniaAction(zamowienieId, 'spakowane');
    setWToku(null);

    if (!wynik.ok) {
      setBlad(wynik.blad);
      return;
    }
    router.refresh();
  }

  if (wyslane) {
    return (
      <div className="mag-akcje">
        <p className="mag-drobne" style={{ margin: 0 }}>
          Paczka nadana. Numer listu jest w sekcji „Dostawa".
        </p>
      </div>
    );
  }

  return (
    <div className="mag-akcje">
      <label className="mag-szukaj" style={{ margin: 0 }}>
        <span className="sr-only">Numer przesyłki</span>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="Numer listu przewozowego"
          value={numer}
          onChange={(e) => setNumer(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="mag-btn"
        onClick={nadaj}
        disabled={wToku !== null || numer.trim() === ''}
      >
        {wToku === 'przesylka' ? 'Nadaję…' : 'Nadaj przesyłkę'}
      </button>

      {stan !== 'spakowane' && (
        <button
          type="button"
          className="mag-btn mag-btn-link"
          onClick={oznacz}
          disabled={wToku !== null}
        >
          {wToku === 'spakowane' ? 'Zapisuję…' : 'Oznacz jako spakowane'}
        </button>
      )}

      {blad && <p className="mag-blad">{blad}</p>}
    </div>
  );
}
