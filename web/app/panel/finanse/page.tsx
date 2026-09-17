import type { Metadata } from 'next';
import { wymagajBiura } from '@/lib/panel-dostep';
import { getFinanse } from '@/lib/queries';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Finanse',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DZIEN = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' });

export default async function Finanse() {
  await wymagajBiura('/panel/finanse');

  const f = await getFinanse(30);
  const maks = Math.max(1, ...f.dni.map((d) => d.przychod));

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Finanse</h1>
          {/* Dopóki w bazie nie ma stawek VAT, wszystkie kwoty są brutto i tak
              mają być podpisane. Nazwanie tego obrotem netto to błąd w księgach. */}
          <p className="muted">Wszystkie kwoty brutto. Sprzedaż liczona z zamówień opłaconych i nieanulowanych.</p>
        </div>
        <div className="admin-toolbar">
          <a className="btn btn-ghost" href="/panel/finanse/eksport?zakres=30">
            Eksport CSV (30 dni)
          </a>
        </div>
      </div>

      <div className="pw-kafle">
        <div className="pw-kafel">
          <span className="label">Dziś</span>
          <span className="pw-liczba num">{money(f.dzis)}</span>
        </div>
        <div className="pw-kafel">
          <span className="label">Ten miesiąc</span>
          <span className="pw-liczba num">{money(f.miesiac)}</span>
          <span className="pw-kafel-opis">
            <span className="num">{f.zamowienMiesiac}</span> zamówień
          </span>
        </div>
        <div className="pw-kafel">
          <span className="label">Marża w miesiącu</span>
          <span className="pw-liczba num">{money(f.marzaMiesiac)}</span>
          <span className="pw-kafel-opis">
            {f.pozycjiBezKosztu > 0
              ? `${f.pozycjiBezKosztu} pozycji bez kosztu — marża jest zaniżona`
              : 'wszystkie pozycje mają koszt'}
          </span>
        </div>
        <div className="pw-kafel">
          <span className="label">Średni koszyk</span>
          <span className="pw-liczba num">{money(f.sredniKoszyk)}</span>
        </div>
      </div>

      {f.pozycjiBezKosztu > 0 && (
        <div className="notice">
          <span>
            Część sprzedanych pozycji nie ma zapisanego kosztu zakupu — dla nich marża liczy się
            jak od zera, czyli za wysoko. Koszty uzupełnisz w{' '}
            <a href="/panel/katalog">Katalogu</a>; zapisują się od chwili wpisania, wstecz nie
            zadziałają.
          </span>
        </div>
      )}

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>Ostatnie 30 dni</h2>
        </div>

        {f.dni.length < 7 ? (
          // Trend z trzech punktów wygląda przekonująco i nie znaczy nic.
          <p className="muted">
            Za mało dni, żeby rysować trend. Liczby wyżej są prawdziwe — wykres pojawi się po
            tygodniu sprzedaży.
          </p>
        ) : (
          <div className="pw-slupki" role="img" aria-label="Przychód dzienny z ostatnich 30 dni">
            {f.dni.map((d) => (
              <div key={d.dzien} className="pw-slupek-kadr" title={`${d.dzien}: ${money(d.przychod)}`}>
                <div
                  className="pw-slupek"
                  style={{ height: `${Math.max(2, (d.przychod / maks) * 100)}%` }}
                />
                <span className="pw-slupek-opis">{DZIEN.format(new Date(d.dzien))}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>Najlepiej sprzedające się</h2>
        </div>

        {f.top.length === 0 ? (
          <p className="muted">Brak sprzedaży do podsumowania.</p>
        ) : (
          <div className="pw-tabela-kadr">
            <table className="pw-tabela">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th className="pw-do-prawej">Sztuk</th>
                  <th className="pw-do-prawej">Przychód</th>
                </tr>
              </thead>
              <tbody>
                {f.top.map((p) => (
                  <tr key={`${p.productId}-${p.nazwa}`}>
                    <td>{p.nazwa}</td>
                    <td className="pw-do-prawej num">{p.sztuk}</td>
                    <td className="pw-do-prawej num">{money(p.przychod)}</td>
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
