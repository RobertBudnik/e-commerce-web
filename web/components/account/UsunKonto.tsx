'use client';

import { useState, useTransition } from 'react';
import { deleteAccountAction } from '@/app/actions/account';

/**
 * Usunięcie konta. Krok potwierdzenia jest tu obowiązkowy, bo akcji nie da się
 * cofnąć — i nie chodzi o „czy na pewno", tylko o powiedzenie wprost, co
 * zniknie, a co zostanie. Klient ma podjąć decyzję z pełną wiedzą, a nie
 * kliknąć i dowiedzieć się po fakcie, że zamówienia zostały w bazie.
 */
export function UsunKonto() {
  const [potwierdza, setPotwierdza] = useState(false);
  const [blad, setBlad] = useState('');
  const [czeka, start] = useTransition();

  function usun() {
    setBlad('');
    start(async () => {
      const wynik = await deleteAccountAction();
      // Powodzenie kończy się przekierowaniem, więc tu dochodzi tylko odmowa.
      if (wynik && !wynik.ok) setBlad(wynik.error);
    });
  }

  return (
    <div className="card-box">
      <h3>Usunięcie konta</h3>

      {!potwierdza ? (
        <>
          <p className="muted">
            Konto, adresy, lista życzeń i wystawione opinie znikają bezpowrotnie.
            Złożone zamówienia zostają, ale bez Twoich danych — prawo nakazuje
            przechowywać dokumenty sprzedaży, więc zostawiamy sam dokument:
            numer, pozycje i kwoty.
          </p>
          <button className="btn btn-ghost" type="button" onClick={() => setPotwierdza(true)}>
            Usuń konto
          </button>
        </>
      ) : (
        <>
          <p className="notice notice-error" role="alert">
            Tej operacji nie da się cofnąć. Po usunięciu nie odzyskasz dostępu
            do historii zamówień ani do zapisanych adresów.
          </p>
          <div className="auth-actions-rzad">
            <button className="btn" type="button" onClick={() => setPotwierdza(false)} disabled={czeka}>
              Zostawiam konto
            </button>
            <button className="btn btn-ghost" type="button" onClick={usun} disabled={czeka}>
              {czeka ? 'Usuwam…' : 'Usuwam nieodwracalnie'}
            </button>
          </div>
        </>
      )}

      {blad && (
        <p className="notice notice-error" role="alert">
          {blad}
        </p>
      )}
    </div>
  );
}
