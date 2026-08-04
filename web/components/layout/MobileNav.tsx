'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

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

  useEffect(() => {
    if (!otwarte) return;

    const poprzedniFokus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    function naKlawisz(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOtwarte(false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Pułapka focusu — wewnątrz panelu Tab krąży, nie ucieka na treść pod spodem
      const cele = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!cele.length) return;
      const pierwszy = cele[0];
      const ostatni = cele[cele.length - 1];

      if (e.shiftKey && document.activeElement === pierwszy) {
        e.preventDefault();
        ostatni.focus();
      } else if (!e.shiftKey && document.activeElement === ostatni) {
        e.preventDefault();
        pierwszy.focus();
      }
    }

    document.addEventListener('keydown', naKlawisz);
    return () => {
      document.removeEventListener('keydown', naKlawisz);
      document.body.style.overflow = '';
      (poprzedniFokus ?? wyzwalaczRef.current)?.focus();
    };
  }, [otwarte]);

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

      {otwarte && (
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
        </div>
      )}
    </>
  );
}
