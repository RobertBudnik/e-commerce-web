'use client';

import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Awaria wewnątrz strony — w odróżnieniu od `global-error.tsx`, który łapie
 * dopiero wywrotkę całego layoutu.
 *
 * Różnica jest praktyczna: tutaj nagłówek, stopka i koszyk stoją, więc klient
 * nie wypada ze sklepu i nie musi zaczynać od strony głównej. Dlatego jest tu
 * `reset()` — ponowne renderowanie tego samego poddrzewa ma sens, gdy błąd
 * wziął się z jednego nieudanego zapytania. Przy padniętym layoucie nie ma,
 * i tam stoi zwykłe przeładowanie.
 *
 * Błędy renderowania po stronie serwera przechwytuje `onRequestError`
 * z `instrumentation.ts`. Ten plik dokłada te, które wydarzyły się już
 * w przeglądarce — bez niego nie doszłyby nigdzie.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="container section">
      <div className="empty">
        <span className="label">Błąd</span>
        <h1>Coś się nie wczytało</h1>
        <p>
          Zgłoszenie poszło do nas automatycznie. Spróbuj jeszcze raz — jeśli to nie pomoże,
          wróć za chwilę albo napisz do nas przez stronę pomocy.
        </p>

        <button className="btn" type="button" onClick={reset}>
          Spróbuj ponownie
        </button>

        {/* Numer zgłoszenia ma sens tylko wtedy, gdy jest — przy błędach
            wyłącznie klienckich Next go nie nadaje. */}
        {error.digest ? (
          <p className="muted num" style={{ fontSize: '.875rem', marginTop: 20 }}>
            Numer zgłoszenia: {error.digest}
          </p>
        ) : null}

        <p style={{ marginTop: 28, marginBottom: 0 }}>
          <Link className="arrow-link" href="/pomoc">
            Pomoc i kontakt
          </Link>
        </p>
      </div>
    </main>
  );
}
