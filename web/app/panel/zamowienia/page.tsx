import type { Metadata } from 'next';
import Link from 'next/link';
import { wymagajPanelu } from '@/lib/panel-dostep';
import { getZamowieniaPanelu } from '@/lib/queries';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Zamówienia',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DATA = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const STANY = ['kolejka', 'nowe', 'spakowane', 'wysłane', 'dostarczone', 'anulowane'];
const PLATNOSCI = ['oczekuje', 'opłacone', 'nieudane', 'zwrócone'];

/**
 * Klasa plakietki dla stanu. Barwa jest tu wzmocnieniem, nie nośnikiem —
 * w każdej plakietce stoi słowo, które mówi to samo, więc czytnik ekranu
 * i osoba nierozróżniająca barw dostają pełną informację.
 *
 * Rozróżnienie jest po to, żeby „nieudane" nie wyglądało jak „oczekuje":
 * pierwsze wymaga reakcji obsługi, drugie tylko czekania na przelew.
 */
function klasaStanu(stan: string): string {
  if (stan === 'opłacone' || stan === 'dostarczone') return 'pw-stan pw-stan-ok';
  if (stan === 'nieudane' || stan === 'anulowane') return 'pw-stan pw-stan-zle';
  if (stan === 'oczekuje' || stan === 'zwrócone') return 'pw-stan pw-stan-uwaga';
  return 'pw-stan';
}

export default async function ZamowieniaPanelu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await wymagajPanelu('/panel/zamowienia');

  const parametry = await searchParams;
  // Filtry siedzą w adresie, nie w stanie komponentu: taki widok da się wysłać
  // pracownikowi i odświeżyć bez utraty tego, na co się patrzy.
  const filtr = {
    stan: STANY.includes(parametry.stan ?? '') ? parametry.stan : undefined,
    platnosc: PLATNOSCI.includes(parametry.platnosc ?? '') ? parametry.platnosc : undefined,
    od: parametry.od || undefined,
    do: parametry.do || undefined,
    szukaj: parametry.szukaj || undefined,
  };

  const zamowienia = await getZamowieniaPanelu(filtr);
  const pusteFiltry = !filtr.stan && !filtr.platnosc && !filtr.od && !filtr.do && !filtr.szukaj;

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Zamówienia</h1>
        </div>
        <div className="admin-toolbar">
          <span className="muted">
            <span className="num">{zamowienia.length}</span> na liście
          </span>
        </div>
      </div>

      {/* Zwykły formularz GET — filtr ląduje w adresie, bez ani jednej linii JS. */}
      <form className="pw-filtry" method="get">
        <label className="pw-pole">
          <span className="label">Stan</span>
          <select name="stan" defaultValue={filtr.stan ?? ''} className="pw-input">
            <option value="">wszystkie</option>
            {STANY.map((s) => (
              <option key={s} value={s}>
                {s === 'kolejka' ? 'do zrobienia' : s}
              </option>
            ))}
          </select>
        </label>

        <label className="pw-pole">
          <span className="label">Płatność</span>
          <select name="platnosc" defaultValue={filtr.platnosc ?? ''} className="pw-input">
            <option value="">wszystkie</option>
            {PLATNOSCI.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="pw-pole">
          <span className="label">Od</span>
          <input type="date" name="od" defaultValue={filtr.od ?? ''} className="pw-input" />
        </label>

        <label className="pw-pole">
          <span className="label">Do</span>
          <input type="date" name="do" defaultValue={filtr.do ?? ''} className="pw-input" />
        </label>

        <label className="pw-pole pw-pole-szerokie">
          <span className="label">Szukaj</span>
          <input
            type="search"
            name="szukaj"
            defaultValue={filtr.szukaj ?? ''}
            placeholder="numer, e-mail, list przewozowy"
            className="pw-input"
          />
        </label>

        <div className="pw-filtry-akcje">
          <button className="btn" type="submit">
            Pokaż
          </button>
          {!pusteFiltry && (
            <Link className="pw-link" href="/panel/zamowienia">
              Wyczyść
            </Link>
          )}
        </div>
      </form>

      {zamowienia.length === 0 ? (
        <p className="muted pw-pusto">
          {pusteFiltry
            ? 'Nie ma jeszcze żadnego zamówienia. Pojawią się tu w chwili złożenia.'
            : 'Brak zamówień w tym zakresie — zmień daty albo wyczyść filtry.'}
        </p>
      ) : (
        <div className="pw-tabela-kadr">
          <table className="pw-tabela">
            <thead>
              <tr>
                <th>Numer</th>
                <th>Data</th>
                <th>Klient</th>
                <th>Stan</th>
                <th>Płatność</th>
                <th>Przesyłka</th>
                <th className="pw-do-prawej">Kwota</th>
              </tr>
            </thead>
            <tbody>
              {zamowienia.map((z) => (
                <tr key={z.id}>
                  {/* Cały wiersz jest wejściem w szczegóły — link w pierwszej
                      komórce rozciągnięty przez ::after w globals.css. */}
                  <td className="pw-komorka-link">
                    <Link className="pw-wejscie" href={`/panel/zamowienia/${encodeURIComponent(z.number)}`}>
                      {z.number}
                    </Link>
                  </td>
                  <td className="num">{DATA.format(new Date(z.date))}</td>
                  <td>{z.customer || z.email}</td>
                  <td>
                    <span className={klasaStanu(z.status)}>{z.status}</span>
                  </td>
                  <td>
                    <span className={klasaStanu(z.paymentStatus)}>{z.paymentStatus}</span>
                  </td>
                  <td className="num">{z.numerPrzesylki ?? <span className="muted">—</span>}</td>
                  <td className="pw-do-prawej num">{money(z.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
