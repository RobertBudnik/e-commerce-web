'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { adjustStockAction } from '@/app/actions/magazyn';
import type { Product } from '@/lib/types';

/** Poniżej tej ilości produkt trafia na górę listy jako wymagający uwagi. */
const PROG_NISKI = 5;

const POWODY = [
  'dostawa',
  'zwrot od klienta',
  'inwentaryzacja',
  'uszkodzenie',
  'pomyłka w liczeniu',
];

export function StockRow({ product }: { product: Product }) {
  const [stan, setStan] = useState(product.stock);
  const [otwarte, setOtwarte] = useState(false);
  const [delta, setDelta] = useState(0);
  const [powod, setPowod] = useState(POWODY[0]);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, start] = useTransition();

  function zapisz() {
    if (delta === 0) return;
    setBlad(null);
    start(async () => {
      const wynik = await adjustStockAction(product.id, delta, powod);
      if (wynik.ok) {
        setStan(wynik.stock);
        setDelta(0);
        setOtwarte(false);
      } else {
        setBlad(wynik.error);
      }
    });
  }

  const brak = stan === 0;
  const niski = stan > 0 && stan <= PROG_NISKI;

  return (
    <li className={`stock-row${brak ? ' stock-brak' : niski ? ' stock-niski' : ''}`}>
      <button
        type="button"
        className="stock-head"
        onClick={() => setOtwarte((v) => !v)}
        aria-expanded={otwarte}
      >
        <span className="stock-name">{product.name}</span>
        <span className="stock-count num" aria-label={`Stan: ${stan} sztuk`}>
          {stan}
        </span>
      </button>

      {otwarte && (
        <div className="stock-edit">
          {/* Korekta jest różnicą, nie nową wartością. Dwie osoby liczące ten
              sam regał wpiszą „+3" i „+2" zamiast dwóch sum, z których jedna
              nadpisałaby drugą. */}
          <div className="stock-delta">
            <button
              type="button"
              onClick={() => setDelta((d) => d - 1)}
              aria-label="Zmniejsz korektę"
              disabled={czeka}
            >
              −
            </button>
            <span className={`stock-delta-val num${delta > 0 ? ' plus' : delta < 0 ? ' minus' : ''}`}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
            <button
              type="button"
              onClick={() => setDelta((d) => d + 1)}
              aria-label="Zwiększ korektę"
              disabled={czeka}
            >
              +
            </button>
          </div>

          <label className="stock-powod">
            <span className="label">Powód</span>
            <select value={powod} onChange={(e) => setPowod(e.target.value)} disabled={czeka}>
              {POWODY.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <p className="stock-podglad num">
            {stan} → <strong>{Math.max(0, stan + delta)}</strong>
          </p>

          <button
            type="button"
            className="btn btn-block"
            onClick={zapisz}
            disabled={czeka || delta === 0}
          >
            {czeka ? 'Zapisuję…' : 'Zapisz korektę'}
          </button>

          {blad && <p className="stock-error">{blad}</p>}
        </div>
      )}

      {brak && !otwarte && (
        <p className="stock-flag">
          <Icon name="info" /> Brak na stanie — sklep nie sprzeda
        </p>
      )}
    </li>
  );
}
