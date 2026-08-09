'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';
import { useOknoModalne } from '@/lib/okno-modalne';

type Pozycja = { href: string; label: string };

/**
 * Nawigacja na wąskim ekranie. Panel pełnoekranowy zamiast zwijanego paska —
 * przy czterech pozycjach i przycisku konta lista mieści się bez przewijania,
 * a duże cele dotykowe są łatwiejsze niż ściśnięty rząd linków.
 */
export function MobileNav({ pozycje }: { pozycje: Pozycja[] }) {
  const [otwarte, setOtwarte] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const wyzwalaczRef = useRef<HTMLButtonElement>(null);

  // Wspólne zachowanie okien nakładkowych — patrz `lib/okno-modalne.ts`.
  // Ten komponent był wcześniej jedynym z pułapką fokusu; hak przeniósł ją
  // do reszty, zamiast kopiować ten sam kod do pięciu innych miejsc.
  useOknoModalne({
    otwarte,
    panel: panelRef,
    zamknij: () => setOtwarte(false),
    wyzwalacz: wyzwalaczRef,
  });

  return (
    <>
      <button
        ref={wyzwalaczRef}
        type="button"
        className="nav-burger"
        onClick={() => setOtwarte(true)}
        aria-label="Otwórz nawigację"
        aria-expanded={otwarte}
      >
        <Icon name="menu" />
      </button>

      {/*
        Panel jedzie portalem do <body>, a nie zostaje przy przycisku.
        Nagłówek ma `backdrop-filter`, a element z filtrem staje się blokiem
        zawierającym dla potomków `position: fixed` — `inset: 0` liczyło się
        wtedy od nagłówka, więc szuflada miała 72 px wysokości i treść strony
        przebijała spod niej. Mini-koszyk i szybki podgląd tego nie łapią,
        bo są zamontowane wprost w layoucie.
      */}
      {otwarte && createPortal(
        <div
          className="navsheet"
          role="dialog"
          aria-modal="true"
          aria-label="Nawigacja"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOtwarte(false);
          }}
        >
          <div className="navsheet-panel" ref={panelRef}>
            <div className="navsheet-top">
              <span className="logo">
                Nordo
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOtwarte(false)}
                aria-label="Zamknij nawigację"
              >
                <Icon name="close" />
              </button>
            </div>

            <nav className="navsheet-list">
              {pozycje.map((p) => (
                <Link key={p.href} href={p.href} onClick={() => setOtwarte(false)}>
                  {p.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
