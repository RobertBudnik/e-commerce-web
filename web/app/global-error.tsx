'use client';

import * as Sentry from '@sentry/nextjs';
import { Fraunces, Inter } from 'next/font/google';
import { useEffect } from 'react';
import './globals.css';

/**
 * Awaria root layoutu — Next zastępuje tu cały dokument, więc strona musi
 * podać własne `<html>` i `<body>`, a kroje załadować sama. Nagłówek, stopka
 * i koszyk nie istnieją: layout, który je renderuje, właśnie się wywrócił.
 *
 * Krojów nie da się wziąć z layoutu, a bez zmiennych `--font-*` reguła
 * `--sans` w globals.css jest nieprawidłowa i typografia leci na systemową.
 */
const display = Fraunces({
  subsets: ['latin-ext'],
  weight: ['400'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin-ext'],
  weight: ['400', '500'],
  variable: '--font-sans',
  display: 'swap',
});

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Ostatnia sieć — na tym poziomie Next nie woła już `onRequestError`.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pl" className={`${display.variable} ${sans.variable}`}>
      <body>
        <main className="section">
          <div className="container" style={{ maxWidth: '46ch' }}>
            <span className="label">Błąd</span>
            <h1>Coś się posypało po naszej stronie</h1>
            <p className="muted">
              Zgłoszenie już do nas poszło. Spróbuj odświeżyć — jeśli to nie pomoże, wróć za chwilę.
            </p>

            {error.digest ? (
              <p className="muted num" style={{ fontSize: '.875rem' }}>
                Numer zgłoszenia: {error.digest}
              </p>
            ) : null}

            <p>
              {/* Zwykłe przeładowanie, nie `reset()`: skoro padł layout,
                  ponowne renderowanie tego samego drzewa padnie tak samo. */}
              <a className="btn" href="/">
                Wróć na stronę główną
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
