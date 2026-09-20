import type { Metadata } from 'next';
import { WyborRoli } from '@/components/panel/WyborRoli';
import { wymagajWlasciciela } from '@/lib/panel-dostep';
import { getOsobyZaplecza } from '@/lib/queries';
import { DATA_PELNA } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Ludzie',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const UPRAWNIENIA: Record<string, string[]> = {
  owner: ['katalog', 'zamówienia', 'magazyn', 'finanse', 'role', 'dziennik'],
  manager: ['katalog', 'zamówienia', 'magazyn', 'finanse'],
  staff: ['zamówienia', 'magazyn'],
  customer: [],
};

export default async function Ludzie() {
  const ja = await wymagajWlasciciela('/panel/ludzie');
  const osoby = await getOsobyZaplecza();

  const wlascicieli = osoby.filter((o) => o.rola === 'owner').length;

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Ludzie</h1>
          <p className="muted">
            Rola decyduje o wszystkim, co konto może zrobić — także wtedy, gdy ktoś zna adres
            ekranu. Sprawdzenia siedzą w bazie, nie w interfejsie.
          </p>
        </div>
      </div>

      {wlascicieli === 1 && (
        <div className="notice">
          <span>
            Jesteś jedynym właścicielem. Baza nie pozwoli zdjąć tej roli ostatniemu właścicielowi —
            sklep bez niej nie jest do odzyskania z panelu. Jeśli chcesz mieć zapasowe wyjście,
            nadaj rolę właściciela drugiej osobie.
          </span>
        </div>
      )}

      <div className="pw-tabela-kadr">
        <table className="pw-tabela">
          <thead>
            <tr>
              <th>Konto</th>
              <th>Od kiedy</th>
              <th>Rola</th>
              <th>Co obejmuje</th>
            </tr>
          </thead>
          <tbody>
            {osoby.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.imie || o.email}
                  {o.imie && <span className="muted"> · {o.email}</span>}
                  {o.id === ja.id && <span className="pw-stan"> to Ty</span>}
                </td>
                <td className="num">{DATA_PELNA.format(new Date(o.odKiedy))}</td>
                <td>
                  <WyborRoli userId={o.id} email={o.email} rola={o.rola} mojeKonto={o.id === ja.id} />
                </td>
                <td className="muted">{UPRAWNIENIA[o.rola]?.join(', ') || 'sam sklep'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>Jak dodać pracownika</h2>
        </div>
        <p className="muted">
          Nowe konto zakłada sama osoba — rejestracją w sklepie albo zaproszeniem z panelu Supabase
          Auth. Potem pojawia się na tej liście i nadajesz jej rolę. Hasła nie ustawiasz za nikogo:
          hasło wpisane przez kogoś innego niż właściciel konta jest hasłem znanym dwóm osobom.
        </p>
      </section>
    </main>
  );
}
