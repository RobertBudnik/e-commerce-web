'use client';

import { useState, useTransition } from 'react';
import { nadajRoleAction } from '@/app/actions/panel';

const ROLE = ['owner', 'manager', 'staff', 'customer'] as const;
type Rola = (typeof ROLE)[number];

/** Co ta rola realnie daje. Właściciel ma wiedzieć, co nadaje, zanim kliknie. */
const CO_DAJE: Record<Rola, string> = {
  owner: 'wszystko, łącznie z rolami, finansami i dziennikiem',
  manager: 'zamówienia, wysyłki, katalog i finanse — bez nadawania ról',
  staff: 'aplikacja magazynu: pakowanie, stany, zwroty. Bez kwot i bez panelu',
  customer: 'zwykłe konto klienta, bez dostępu do zaplecza',
};

export function WyborRoli({
  userId,
  email,
  rola,
  mojeKonto,
}: {
  userId: string;
  email: string;
  rola: string;
  mojeKonto: boolean;
}) {
  const [wybrana, setWybrana] = useState<Rola>((rola as Rola) ?? 'customer');
  const [blad, setBlad] = useState<string | null>(null);
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [czekam, start] = useTransition();

  function zmien(nowa: Rola) {
    if (nowa === wybrana) return;

    // Zmiana uprawnień innego człowieka jest trudna do cofnięcia po fakcie —
    // pyta o potwierdzenie. Reszta akcji w panelu nie pyta, i tak ma zostać:
    // potwierdzenie przy każdym kliknięciu uczy klikać „tak" bez czytania.
    if (!confirm(`Nadać koncie ${email} rolę „${nowa}"? Dostanie: ${CO_DAJE[nowa]}.`)) return;

    setBlad(null);
    setKomunikat(null);
    start(async () => {
      const wynik = await nadajRoleAction(userId, nowa);
      if (wynik.ok) {
        setWybrana(nowa);
        setKomunikat(
          mojeKonto
            ? 'Zapisane. Wyloguj się i zaloguj ponownie — Twój token wciąż niesie starą rolę.'
            : 'Zapisane. Zadziała, gdy ta osoba zaloguje się ponownie — rola jedzie w tokenie.'
        );
      } else {
        setBlad(wynik.blad);
      }
    });
  }

  return (
    <div className="pw-rola">
      <select
        className="pw-input"
        aria-label={`Rola konta ${email}`}
        value={wybrana}
        disabled={czekam}
        onChange={(e) => zmien(e.target.value as Rola)}
      >
        {ROLE.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {komunikat && (
        <span className="pw-komunikat" role="status">
          {komunikat}
        </span>
      )}
      {blad && (
        <span className="pw-blad" role="status">
          {blad}
        </span>
      )}
    </div>
  );
}
