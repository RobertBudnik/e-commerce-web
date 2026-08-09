'use client';

import { useRef, useState } from 'react';
import { zglosZwrotAction } from '@/app/actions/shop';
import { useOknoModalne } from '@/lib/okno-modalne';
import type { Order } from '@/lib/types';

/**
 * Zgłoszenie zwrotu przez klienta.
 *
 * Osobne okno, nie rozwijany blok w kafelku zamówienia: wybór pozycji i ilości
 * to kilka decyzji, a rozwinięty formularz rozpychałby listę zamówień przy
 * każdym otwarciu. Okno zamyka Escape i kliknięcie w tło, focus wchodzi do
 * panelu i wraca na przycisk — tak samo jak szuflada koszyka i szybki podgląd.
 */
export function ZgloszenieZwrotu({ order }: { order: Order }) {
  const [otwarte, setOtwarte] = useState(false);
  const [ilosci, setIlosci] = useState<Record<string, number>>({});
  const [powod, setPowod] = useState('');
  const [wysylam, setWysylam] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [zgloszony, setZgloszony] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const wyzwalaczRef = useRef<HTMLButtonElement>(null);

  // Wspólne zachowanie okien nakładkowych — patrz `lib/okno-modalne.ts`.
  // Wcześniej brakowało tu pułapki fokusu: Tab wychodził z okna na listę
  // zamówień pod spodem, a klient wybierał pozycje do zwrotu w oknie,
  // którego już nie miał pod palcami.
  useOknoModalne({
    otwarte,
    panel: panelRef,
    zamknij: () => setOtwarte(false),
    wyzwalacz: wyzwalaczRef,
  });

  const wybrane = Object.entries(ilosci).filter(([, q]) => q > 0);
  const sztuk = wybrane.reduce((a, [, q]) => a + q, 0);

  async function wyslij() {
    setBlad(null);
    setWysylam(true);

    const wynik = await zglosZwrotAction(
      order.id,
      wybrane.map(([productId, qty]) => ({ productId, qty })),
      powod
    );
    setWysylam(false);

    if (!wynik.ok) {
      setBlad(wynik.blad);
      return;
    }

    setZgloszony(true);
    setOtwarte(false);
  }

  if (zgloszony) {
    return (
      <p className="zwrot-info" role="status">
        Zwrot zgłoszony. Odeślij paczkę — magazyn przyjmie ją po dostarczeniu.
      </p>
    );
  }

  return (
    <>
      <button
        ref={wyzwalaczRef}
        type="button"
        className="btn-link"
        onClick={() => setOtwarte(true)}
      >
        Zgłoś zwrot
      </button>

      {otwarte && (
        <div
          className="zwrot-tlo"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`zwrot-${order.id}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOtwarte(false);
          }}
        >
          <div className="zwrot-panel" ref={panelRef}>
            <div className="zwrot-gora">
              <h2 id={`zwrot-${order.id}`}>Zwrot z zamówienia</h2>
              <button
                type="button"
                className="icon-btn"
                aria-label="Zamknij zgłoszenie zwrotu"
                onClick={() => setOtwarte(false)}
              >
                ×
              </button>
            </div>
            <p className="zwrot-numer num">{order.number}</p>

            <ul className="zwrot-lista">
              {order.items.map((p) => {
                const id = p.productId ?? '';
                const ile = ilosci[id] ?? 0;
                return (
                  <li key={id || p.name}>
                    <div className="zwrot-poz">
                      <span className="zwrot-nazwa">{p.name}</span>
                      <span className="muted num">kupione: {p.qty} szt.</span>
                    </div>
                    {/* Krokiem, nie polem tekstowym: ilość jest mała i ograniczona
                        z góry przez to, co klient kupił. */}
                    <div className="zwrot-krok">
                      <button
                        type="button"
                        aria-label={`Mniej sztuk: ${p.name}`}
                        disabled={ile === 0 || !id}
                        onClick={() => setIlosci((s) => ({ ...s, [id]: Math.max(0, ile - 1) }))}
                      >
                        −
                      </button>
                      <span className="num">{ile}</span>
                      <button
                        type="button"
                        aria-label={`Więcej sztuk: ${p.name}`}
                        disabled={ile >= p.qty || !id}
                        onClick={() => setIlosci((s) => ({ ...s, [id]: Math.min(p.qty, ile + 1) }))}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <label className="zwrot-powod">
              <span className="label">Powód (nieobowiązkowy)</span>
              <input
                type="text"
                value={powod}
                onChange={(e) => setPowod(e.target.value)}
                placeholder="np. nie pasuje rozmiar"
              />
            </label>

            {blad && <p className="zwrot-blad">{blad}</p>}

            <button
              type="button"
              className="btn btn-block"
              disabled={sztuk === 0 || wysylam}
              onClick={wyslij}
            >
              {wysylam ? 'Zgłaszam…' : sztuk === 0 ? 'Zaznacz, co odsyłasz' : `Zgłoś zwrot · ${sztuk} szt.`}
            </button>

            <p className="zwrot-drobne">
              Masz 30 dni od dostarczenia. Pieniądze wracają po przyjęciu paczki w magazynie.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
