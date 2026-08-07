'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OdczytKodu } from './OdczytKodu';
import {
  nadajPrzesylkeAction,
  ustawStanZamowieniaAction,
} from '@/app/actions/magazyn';

type Props = {
  zamowienieId: string;
  stan: string;
  numerPrzesylki: string | null;
};

/**
 * Dolne akcje karty zamówienia.
 *
 * Numer listu wpisuje się w arkuszu, nie w polu nad przyciskiem: przy
 * zamówieniu, które dopiero czeka na spakowanie, to pole było pustym
 * prostokątem zabierającym miejsce na każdym otwarciu karty. Arkusz
 * pojawia się wtedy, gdy paczka faktycznie jedzie.
 *
 * Numer można wpisać z klawiatury albo odczytać z etykiety kuriera —
 * etykieta niesie kod kreskowy tak samo jak opakowanie produktu, a
 * przepisywanie dwudziestu cyfr z ekranu telefonu to najprostsza droga do
 * pomyłki w jednej z nich.
 */
export function AkcjeZamowienia({ zamowienieId, stan, numerPrzesylki }: Props) {
  const router = useRouter();

  const [arkusz, setArkusz] = useState(false);
  const [skanuje, setSkanuje] = useState(false);
  const [numer, setNumer] = useState('');
  const [wToku, setWToku] = useState<'przesylka' | 'spakowane' | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const wyzwalaczRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!arkusz) return;

    const poprzedni = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input, button')?.focus();

    function naKlawisz(e: KeyboardEvent) {
      if (e.key === 'Escape') setArkusz(false);
    }
    document.addEventListener('keydown', naKlawisz);

    return () => {
      document.removeEventListener('keydown', naKlawisz);
      document.body.style.overflow = '';
      (poprzedni ?? wyzwalaczRef.current)?.focus();
    };
  }, [arkusz]);

  // Stabilne referencje, inaczej kadr montowałby się od nowa przy każdym
  // renderze arkusza i kamera mrugałaby po każdym znaku w polu.
  const naKod = useCallback((kod: string) => {
    setNumer(kod);
    setSkanuje(false);
  }, []);

  const naBladOdczytu = useCallback((komunikat: string) => {
    setBlad(komunikat);
    setSkanuje(false);
  }, []);

  async function nadaj() {
    setBlad(null);
    setWToku('przesylka');
    const wynik = await nadajPrzesylkeAction(zamowienieId, numer);
    setWToku(null);

    if (!wynik.ok) {
      setBlad(wynik.blad);
      return;
    }
    setArkusz(false);
    router.refresh();
  }

  async function oznacz() {
    setBlad(null);
    setWToku('spakowane');
    const wynik = await ustawStanZamowieniaAction(zamowienieId, 'spakowane');
    setWToku(null);

    if (!wynik.ok) {
      setBlad(wynik.blad);
      return;
    }
    router.refresh();
  }

  if (numerPrzesylki) {
    return (
      <div className="mag-akcje">
        <p className="mag-drobne" style={{ margin: 0 }}>
          paczka nadana · numer listu w sekcji „dostawa&rdquo;
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mag-akcje">
        <button
          ref={wyzwalaczRef}
          type="button"
          className="mag-btn"
          onClick={() => setArkusz(true)}
        >
          Nadaj przesyłkę
        </button>

        {stan !== 'spakowane' && (
          <button
            type="button"
            className="mag-btn mag-btn-link"
            onClick={oznacz}
            disabled={wToku !== null}
          >
            {wToku === 'spakowane' ? 'Zapisuję…' : 'Oznacz jako spakowane'}
          </button>
        )}

        {!arkusz && blad && <p className="mag-blad">{blad}</p>}
      </div>

      {arkusz && (
        <div
          className="mag-sheet-tlo"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arkusz-przesylki"
          onClick={(e) => {
            if (e.target === e.currentTarget) setArkusz(false);
          }}
        >
          <div className="mag-sheet" ref={panelRef}>
            <div className="mag-sheet-gora">
              <h2 id="arkusz-przesylki">Nadanie przesyłki</h2>
              <button
                type="button"
                className="mag-sheet-zamknij"
                onClick={() => setArkusz(false)}
              >
                Zamknij
              </button>
            </div>

            <label>
              <span className="sr-only">Numer listu przewozowego</span>
              <input
                className="mag-sheet-pole"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="Numer listu przewozowego"
                value={numer}
                onChange={(e) => setNumer(e.target.value)}
              />
            </label>

            {skanuje ? (
              <>
                <OdczytKodu naKod={naKod} naBlad={naBladOdczytu} />
                <p className="mag-podpowiedz">ustaw kod z etykiety w kadrze</p>
                <button
                  type="button"
                  className="mag-btn mag-btn-link"
                  onClick={() => setSkanuje(false)}
                >
                  Przerwij skanowanie
                </button>
              </>
            ) : (
              <button
                type="button"
                className="mag-btn mag-btn-link"
                style={{ marginTop: 6 }}
                onClick={() => {
                  setBlad(null);
                  setSkanuje(true);
                }}
              >
                Skanuj numer z etykiety
              </button>
            )}

            {blad && <p className="mag-blad">{blad}</p>}

            <button
              type="button"
              className="mag-btn"
              style={{ marginTop: 10 }}
              onClick={nadaj}
              disabled={wToku !== null || numer.trim() === ''}
            >
              {wToku === 'przesylka' ? 'Nadaję…' : 'Nadaj przesyłkę'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
