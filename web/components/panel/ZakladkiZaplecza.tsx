'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PozycjaZakladki = {
  href: string;
  etykieta: string;
  /** Do wstawienia kreski tam, gdzie zmienia się rodzaj pracy. */
  grupa: 'zaplecze' | 'biuro' | 'wlasciciel';
};

/**
 * Pasek zakładek zaplecza.
 *
 * Klient wyłącznie po to, żeby wiedzieć, która zakładka jest otwarta —
 * `usePathname` jest tu tańsze niż przekazywanie segmentu z układu przez
 * kolejne poziomy. Filtrowanie rolą dzieje się po stronie serwera: tutaj
 * przychodzi już gotowa lista, więc przeglądarka nie dostaje nawet nazw
 * ekranów, do których ten człowiek nie ma wstępu.
 */
export function ZakladkiZaplecza({ pozycje }: { pozycje: PozycjaZakladki[] }) {
  const sciezka = usePathname();

  /**
   * Pulpit stoi pod `/panel`, więc porównanie „zaczyna się od" zapaliłoby go
   * na każdym ekranie zaplecza. Dla niego liczy się równość, dla reszty
   * prefiks — inaczej `/panel/stany/[id]` gasi zakładkę „Stany".
   */
  const aktywna = (href: string) =>
    href === '/panel' ? sciezka === '/panel' : sciezka.startsWith(href);

  return (
    <nav className="pw-nav container" aria-label="Sekcje zaplecza">
      {pozycje.map((p, i) => {
        const poprzednia = pozycje[i - 1];
        const nowaGrupa = poprzednia && poprzednia.grupa !== p.grupa;

        return (
          <span className="pw-zakladka-slot" key={p.href}>
            {/* Kreska tylko tam, gdzie po obu stronach coś stoi — przy samym
                `staff` widać jedną grupę i separator nie miałby czego dzielić. */}
            {nowaGrupa && <span className="pw-rozdzielacz" aria-hidden="true" />}
            <Link
              className="pw-zakladka"
              href={p.href}
              aria-current={aktywna(p.href) ? 'page' : undefined}
            >
              {p.etykieta}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
