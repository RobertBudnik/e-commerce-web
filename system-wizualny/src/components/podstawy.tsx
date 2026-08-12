import type { ReactNode } from 'react';

/**
 * Prymitywy systemu. Każdy kształt ma tu jedną definicję — ekrany składają się
 * z nich, a nie z własnych zestawów klas. Dzięki temu zmiana promienia albo
 * odcienia badge'a jest jedną zmianą, nie polowaniem po plikach.
 */

type Wariant = 'primary' | 'ghost';

export function Button({
  children,
  wariant = 'primary',
  maly,
  disabled,
}: {
  children: ReactNode;
  wariant?: Wariant;
  maly?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn btn-${wariant}${maly ? ' btn-sm' : ''}`}
    >
      {children}
    </button>
  );
}

/**
 * Odcienie badge'a. Stany zamówienia celowo dzielą jeden neutralny odcień:
 * kolor niesie tu wyłącznie informację o pieniądzach (opłacone / oczekuje)
 * i o rabacie. Gdyby każdy stan dostał własną barwę, tabela zamówień
 * zamieniłaby się w witraż, w którym nic nie wystaje.
 */
export const ODCIENIE = {
  neutral: 'bg-tint text-ink-2',
  ok: 'bg-green text-green-text',
  wait: 'bg-amber text-amber-text',
  sale: 'bg-orange text-white',
  solid: 'bg-ink text-bg',
} as const;

export type Odcien = keyof typeof ODCIENIE;

export function Badge({ children, odcien = 'neutral' }: { children: ReactNode; odcien?: Odcien }) {
  return <span className={`pill ${ODCIENIE[odcien]}`}>{children}</span>;
}

export function Avatar({ inicjaly }: { inicjaly: string }) {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-medium text-bg">
      {inicjaly}
    </span>
  );
}

/** Nadtytuł + tytuł. Ten sam rytm na każdej stronie panelu i w dokumentacji. */
export function Naglowek({
  overline,
  tytul,
  opis,
  akcja,
}: {
  overline: string;
  tytul: string;
  opis?: string;
  akcja?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="t-overline">{overline}</p>
        <h1 className="t-page-title mt-2">{tytul}</h1>
        {opis && <p className="t-body mt-3 max-w-prose text-ink-2">{opis}</p>}
      </div>
      {akcja}
    </header>
  );
}

/** Sekcja dokumentacji: tytuł serifem, jedno zdanie o tym, po co to jest. */
export function Sekcja({
  tytul,
  opis,
  children,
}: {
  tytul: string;
  opis?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border py-14">
      <h2 className="t-h2">{tytul}</h2>
      {opis && <p className="t-body mt-2 max-w-prose text-ink-2">{opis}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Stat({ etykieta, wartosc, meta }: { etykieta: string; wartosc: string; meta?: string }) {
  return (
    <div className="bg-nav-bg p-6">
      <p className="t-overline">{etykieta}</p>
      <p className="t-stat mt-3">{wartosc}</p>
      {meta && <p className="t-caption mt-2 text-ink-3">{meta}</p>}
    </div>
  );
}

/** Siatka kafli — jedna hairline'owa krata zamiast ramki wokół każdego kafla. */
export function Kafle({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

export type Kolumna<T> = {
  klucz: keyof T & string;
  naglowek: string;
  doPrawej?: boolean;
  render?: (wiersz: T) => ReactNode;
};

/** Tabela: nagłówki Interem 11px w wersalikach, liczby do prawej, hairline'y. */
export function Tabela<T extends { id: string }>({
  kolumny,
  wiersze,
}: {
  kolumny: Kolumna<T>[];
  wiersze: T[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {kolumny.map((k) => (
              <th
                key={k.klucz}
                className={`t-th border-b border-border px-3 py-3 whitespace-nowrap${
                  k.doPrawej ? ' text-right' : ''
                }`}
              >
                {k.naglowek}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {wiersze.map((w) => (
            <tr key={w.id} className="transition-colors hover:bg-surface">
              {kolumny.map((k) => (
                <td
                  key={k.klucz}
                  className={`t-small border-b border-border px-3 py-3${
                    k.doPrawej ? ' text-right tabular-nums' : ''
                  }`}
                >
                  {k.render ? k.render(w) : String(w[k.klucz])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
