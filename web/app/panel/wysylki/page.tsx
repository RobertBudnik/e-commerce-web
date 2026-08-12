import type { Metadata } from 'next';
import Link from 'next/link';
import { AkcjeZamowienia } from '@/components/panel/AkcjeZamowienia';
import { wymagajPanelu } from '@/lib/panel-dostep';
import { getDoNadania, getWDrodze } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Wysyłki',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const CZAS = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Trzy stany, na które mapujemy surowy status od przewoźnika. Lista statusów
 * po ich stronie jest dłuższa i bywa zmieniana — dlatego mapowanie żyje tutaj,
 * a w bazie zostaje to, co przyszło.
 */
function czytelnyStatus(status: string | null): string {
  if (!status) return 'w drodze';
  const s = status.toLowerCase();
  if (s.includes('deliver') || s.includes('odebran')) return 'doręczona';
  if (s.includes('ready') || s.includes('pickup') || s.includes('odbior')) return 'do odbioru';
  return 'w drodze';
}

export default async function Wysylki() {
  await wymagajPanelu('/panel/wysylki');

  const [doNadania, wDrodze] = await Promise.all([getDoNadania(), getWDrodze()]);

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Wysyłki</h1>
        </div>
      </div>

      <div className="notice">
        <span>
          Numer listu wklejasz na razie z panelu przewoźnika. Integracja z InPostem doda tworzenie
          przesyłki i etykietę — po stronie serwera, bo token pozwala nadawać paczki na Twój
          rachunek. Otwierania skrytki nie będzie: API tego nie udostępnia sprzedawcy, skrytkę
          otwiera kod z etykiety albo aplikacja InPost przy automacie.
        </span>
      </div>

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>Do nadania</h2>
          <span className="muted">
            <span className="num">{doNadania.length}</span> spakowanych bez listu
          </span>
        </div>

        {doNadania.length === 0 ? (
          <p className="muted">
            Nic nie czeka. Paczki trafiają tu, gdy magazyn oznaczy je jako spakowane.
          </p>
        ) : (
          <ul className="pw-lista pw-lista-luzna">
            {doNadania.map((z) => (
              <li key={z.id} className="pw-karta-wysylki">
                <div className="pw-karta-glowa">
                  <Link className="pw-wejscie" href={`/panel/zamowienia/${encodeURIComponent(z.number)}`}>
                    {z.number}
                  </Link>
                  <span className="muted">
                    {z.customer || z.email} ·{' '}
                    {z.punktOdbioru ? `paczkomat ${z.punktOdbioru}` : 'kurier pod adres'}
                  </span>
                </div>
                <AkcjeZamowienia
                  zamowienieId={z.id}
                  stan={z.status}
                  numerPrzesylki={z.numerPrzesylki}
                  punktOdbioru={z.punktOdbioru}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>W drodze</h2>
        </div>

        {wDrodze.length === 0 ? (
          <p className="muted">Żadna paczka nie wyjechała.</p>
        ) : (
          <div className="pw-tabela-kadr">
            <table className="pw-tabela">
              <thead>
                <tr>
                  <th>Numer</th>
                  <th>List</th>
                  <th>Przewoźnik</th>
                  <th>Punkt</th>
                  <th>Status</th>
                  <th>Odczyt</th>
                </tr>
              </thead>
              <tbody>
                {wDrodze.map(({ zamowienie: z, przesylka: p }) => (
                  <tr key={z.id}>
                    <td className="pw-komorka-link">
                      <Link className="pw-wejscie" href={`/panel/zamowienia/${encodeURIComponent(z.number)}`}>
                        {z.number}
                      </Link>
                    </td>
                    <td className="num">{z.numerPrzesylki}</td>
                    <td>{p?.przewoznik ?? '—'}</td>
                    <td>{p?.punktOdbioru ?? z.punktOdbioru ?? <span className="muted">pod adres</span>}</td>
                    <td>
                      <span className="pw-stan">{czytelnyStatus(p?.status ?? null)}</span>
                    </td>
                    {/* Data odczytu obok statusu, nie zamiast niego: „doręczono"
                        bez daty nie mówi, czy to sprzed minuty, czy sprzed dni. */}
                    <td className="num">
                      {p?.statusOdczyt ? (
                        CZAS.format(new Date(p.statusOdczyt))
                      ) : (
                        <span className="muted">brak</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
