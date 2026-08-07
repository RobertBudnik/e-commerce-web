'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { korygujStanAction } from '@/app/actions/magazyn';
import { POWODY_KOREKTY } from '@/lib/magazyn-powody';
import { zeZnakiem } from '@/lib/format';

type Props = {
  produktId: string;
  stanZBazy: number;
  progNiski: number;
};

const SKROTY = [1, 5, 10, 50];

/**
 * Korekta stanu jednego produktu.
 *
 * Liczba na ekranie jest wynikiem, nie wartością docelową do wpisania:
 * magazynier liczy sztuki w kartonie i dokłada je do tego, co już jest.
 * Wpisywanie sumy kończy się nadpisaniem cudzej korekty sprzed minuty.
 *
 * Klucz idempotencji powstaje raz, przy otwarciu ekranu. Drugie dotknięcie
 * „Zapisz" wysyła ten sam klucz i baza oddaje stan zamiast dokładać drugi
 * ruch — a po udanym zapisie klucz jest odświeżany, żeby kolejna świadoma
 * korekta tego samego produktu miała własną tożsamość.
 */
export function KorektaStanu({ produktId, stanZBazy, progNiski }: Props) {
  const router = useRouter();

  const [stan, setStan] = useState(stanZBazy);
  const [delta, setDelta] = useState(0);
  const [wDol, setWDol] = useState(false);
  const [powod, setPowod] = useState<string | null>(null);
  const [notatka, setNotatka] = useState('');
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [klucz, setKlucz] = useState(() => crypto.randomUUID());

  const wynik = stan + delta;
  const ponizejZera = wynik < 0;
  const mozeZapisac = delta !== 0 && powod !== null && !ponizejZera && !zapisuje;

  const kierunek = wDol ? -1 : 1;

  const opisDelty = useMemo(() => {
    if (delta === 0) return `było ${stan}`;
    return `było ${stan} · ${zeZnakiem(delta)}`;
  }, [delta, stan]);

  function zmien(o: number) {
    setBlad(null);
    setDelta((d) => d + o);
  }

  async function zapisz() {
    if (!powod) return;
    setBlad(null);
    setZapisuje(true);

    const wynikAkcji = await korygujStanAction(produktId, delta, powod, notatka, klucz);
    setZapisuje(false);

    if (!wynikAkcji.ok) {
      // Po błędzie liczba na ekranie wraca do wartości z bazy — inaczej
      // magazynier patrzy na stan, którego nigdzie nie ma.
      setStan(stanZBazy);
      setDelta(0);
      setBlad(wynikAkcji.blad);
      return;
    }

    setStan(wynikAkcji.stan);
    setDelta(0);
    setNotatka('');
    setPowod(null);
    setKlucz(crypto.randomUUID());
    router.refresh();
  }

  return (
    <>
      <div className="mag-korekta">
        <p className="mag-korekta-gora">
          <span>Po zapisie</span>
          {progNiski > 0 ? (
            <span className="mag-korekta-prog">próg {progNiski}</span>
          ) : (
            <span>bez progu</span>
          )}
        </p>

        <div className="mag-korekta-srodek">
          <button
            type="button"
            className="mag-krok"
            onClick={() => zmien(-1)}
            aria-label="Zdejmij jedną sztukę"
          >
            −
          </button>
          <span className="mag-korekta-wynik" aria-live="polite">
            {Math.max(wynik, 0)}
          </span>
          <button
            type="button"
            className="mag-krok mag-krok-plus"
            onClick={() => zmien(1)}
            aria-label="Dodaj jedną sztukę"
          >
            +
          </button>
        </div>

        <p className="mag-korekta-delta">
          {opisDelty.split('·').map((czesc, i) => (
            <span key={i} className={i === 1 ? (delta > 0 ? 'plus' : 'minus') : undefined}>
              {i > 0 ? ' · ' : ''}
              {czesc.trim()}
            </span>
          ))}
        </p>

        {/* Komunikat przy liczbie, nie w okienku — okienko zabiera ekran
            i nie mówi, której liczby dotyczy. */}
        {ponizejZera && (
          <p className="mag-blad" style={{ marginTop: 8 }}>
            Na stanie jest {stan} szt., nie można zdjąć {Math.abs(delta)}
          </p>
        )}

        {/* Skoki siedzą w tej samej karcie co licznik — należą do niego,
            a nie do ekranu. Poza kartą wyglądały jak osobna sekcja. */}
        <div className="mag-skroty">
          {SKROTY.map((krok) => (
            <button
              key={krok}
              type="button"
              className="mag-skrot"
              aria-pressed={delta === krok * kierunek}
              onClick={() => {
                setBlad(null);
                setDelta(krok * kierunek);
              }}
            >
              {kierunek > 0 ? `+${krok}` : `−${krok}`}
            </button>
          ))}
        </div>
      </div>

      {/* Kierunek zmienia znaczenie skoków. Makieta pokazuje wyłącznie stan
          dodawania, więc przełącznik jest tu cicho, jako podpis karty —
          ale zostaje: bez niego zdjęcie pięćdziesięciu sztuk to pięćdziesiąt
          dotknięć minusa. */}
      <button
        type="button"
        className="mag-kierunek"
        onClick={() => {
          setWDol((w) => !w);
          setDelta(0);
        }}
      >
        {wDol ? 'przełącz na dodawanie' : 'przełącz na odejmowanie'}
      </button>

      <h2 className="mag-sekcja">Powód</h2>
      <div className="mag-karta">
        {POWODY_KOREKTY.map((p) => (
          <button
            key={p}
            type="button"
            className="mag-wiersz mag-wybor"
            role="radio"
            aria-checked={powod === p}
            onClick={() => {
              setBlad(null);
              setPowod(p);
            }}
          >
            <span className="mag-tresc">
              <span className="mag-nazwa">{p}</span>
            </span>
            {powod === p && <span className="mag-znacznik" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <h2 className="mag-sekcja">Notatka</h2>
      <div style={{ marginInline: 'var(--mag-gutter)' }}>
        <textarea
          className="mag-notatka"
          rows={2}
          placeholder="Nieobowiązkowa — np. numer kartonu"
          value={notatka}
          onChange={(e) => setNotatka(e.target.value)}
        />
      </div>

      {/* Pasek zapisu jest przyklejony do dołu; bez zapasu ostatni wiersz
          notatki chowałby się pod nim przy końcu przewijania. */}
      <div className="mag-zapas" />

      <div className="mag-akcje">
        <button type="button" className="mag-btn" onClick={zapisz} disabled={!mozeZapisac}>
          {zapisuje
            ? 'Zapisuję…'
            : delta === 0
              ? 'Zapisz zmianę'
              : `Zapisz zmianę · ${zeZnakiem(delta)} szt.`}
        </button>
        {blad && <p className="mag-blad">{blad}</p>}
        <p className="mag-drobne" style={{ margin: 0 }}>
          zmiana widoczna w sklepie od razu
        </p>
      </div>
    </>
  );
}
