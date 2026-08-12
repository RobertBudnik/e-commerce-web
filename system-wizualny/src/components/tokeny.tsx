import { useEffect, useState } from 'react';

/**
 * Legenda tokenów czytana z CSS-a, nie przepisana do JS-a.
 *
 * Lista niżej trzyma wyłącznie nazwy i po co dany token jest. Wartość dojeżdża
 * z `getComputedStyle`, więc po zmianie palety w `@theme` dokumentacja
 * poprawia się sama. Druga kopia hexów w kodzie oznaczałaby, że prędzej czy
 * później legenda zacznie kłamać — a wtedy jest gorsza niż jej brak.
 */

const GRUPY: { nazwa: string; tokeny: { token: string; poCo: string }[] }[] = [
  {
    nazwa: 'Tła',
    tokeny: [
      { token: 'bg', poCo: 'główne tło strony — ciepła biel' },
      { token: 'surface', poCo: 'karty, miejsce po zdjęciu, sekcje' },
      { token: 'surface-2', poCo: 'hover karty, aktywny filtr' },
      { token: 'nav-bg', poCo: 'nawigacja i kafle — czysta biel' },
      { token: 'tint', poCo: 'tło badge’a stanu' },
    ],
  },
  {
    nazwa: 'Tekst',
    tokeny: [
      { token: 'ink', poCo: 'treść — ciepła czerń' },
      { token: 'ink-2', poCo: 'opisy, drugi plan' },
      { token: 'ink-3', poCo: 'etykiety, meta, placeholder' },
      { token: 'ink-4', poCo: 'wyciszone, nieaktywne' },
    ],
  },
  {
    nazwa: 'Akcent i status',
    tokeny: [
      { token: 'orange', poCo: 'terakota — dane i rabat, nic więcej' },
      { token: 'orange-dim', poCo: 'tło znacznika przeceny' },
      { token: 'green', poCo: 'tło „opłacone", „dostępny"' },
      { token: 'green-text', poCo: 'napis na zielonym' },
      { token: 'amber', poCo: 'tło „oczekuje"' },
      { token: 'amber-text', poCo: 'napis na bursztynie' },
    ],
  },
  {
    nazwa: 'Linie',
    tokeny: [
      { token: 'border', poCo: 'hairline — domyślny podział' },
      { token: 'border-md', poCo: 'pole formularza w spoczynku' },
      { token: 'border-strong', poCo: 'obrys przycisku ghost' },
      { token: 'border-focus', poCo: 'pole w fokusie' },
    ],
  },
];

function odczytaj(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
}

export function Tokeny() {
  const [wartosci, setWartosci] = useState<Record<string, string>>({});

  useEffect(() => {
    const pary: Record<string, string> = {};
    for (const grupa of GRUPY) for (const t of grupa.tokeny) pary[t.token] = odczytaj(t.token);
    setWartosci(pary);
  }, []);

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {GRUPY.map((grupa) => (
        <div key={grupa.nazwa}>
          <p className="t-overline">{grupa.nazwa}</p>
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {grupa.tokeny.map((t) => (
              <li key={t.token} className="flex items-center gap-4 py-3">
                <span
                  className="h-9 w-9 flex-none rounded-lg border border-border"
                  style={{ background: `var(--color-${t.token})` }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <code className="t-small">--color-{t.token}</code>
                  <span className="t-caption block text-ink-3">{t.poCo}</span>
                </span>
                <code className="t-caption tabular-nums text-ink-3">{wartosci[t.token] ?? '…'}</code>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
