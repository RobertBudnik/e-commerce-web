import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AkcjeZamowienia } from '@/components/panel/AkcjeZamowienia';
import { wymagajZaplecza } from '@/lib/panel-dostep';
import { getZamowieniePanelu } from '@/lib/queries';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Zamówienie',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const CZAS = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function SzczegolyZamowienia({
  params,
  searchParams,
}: {
  params: Promise<{ numer: string }>;
  searchParams: Promise<{ powrot?: string; stan?: string }>;
}) {
  /**
   * Jeden ekran zamówienia dla całego zaplecza — także dla magazyniera, bo po
   * scaleniu nie ma drugiego. Wpuszczamy więc `staff`, ale zakres danych tnie
   * się rolą po stronie serwera, nie CSS-em: kwota schowana klasą nadal jedzie
   * do przeglądarki i stoi w źródle strony.
   *
   * Co zostaje magazynierowi: imię, adres, punkt odbioru, list przewozowy
   * i pozycje ze sztukami. Bez tego nie spakuje. Co znika: kwoty, e-mail,
   * telefon i stan płatności — przy pakowaniu bezużyteczne, a to dane
   * kontaktowe cudzego klienta.
   */
  const user = await wymagajZaplecza('/panel/zamowienia');
  const pakujacy = user.rawRole === 'staff';

  const { numer } = await params;
  const { powrot } = await searchParams;
  const dane = await getZamowieniePanelu(decodeURIComponent(numer));
  if (!dane) notFound();

  const { zamowienie: z, przesylka, slad } = dane;

  // Powrót tam, skąd przyszedł: z kolejki do kolejki, z listy do listy.
  const wroc = powrot === 'kolejka' || pakujacy
    ? { href: '/panel/kolejka', etykieta: '← Kolejka' }
    : { href: '/panel/zamowienia', etykieta: '← Zamówienia' };

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <Link className="pw-link" href={wroc.href}>
            {wroc.etykieta}
          </Link>
          <h1>{z.number}</h1>
          <p className="muted">
            {CZAS.format(new Date(z.date))} · {z.status}
            {!pakujacy && <> · płatność {z.paymentStatus}</>}
          </p>
        </div>
        {!pakujacy && (
          <div className="admin-toolbar">
            <span className="pw-liczba num">{money(z.total)}</span>
          </div>
        )}
      </div>

      <AkcjeZamowienia
        zamowienieId={z.id}
        stan={z.status}
        numerPrzesylki={z.numerPrzesylki}
        punktOdbioru={z.punktOdbioru}
      />

      <div className="pw-dwie-kolumny">
        <section className="pw-sekcja">
          <div className="pw-sekcja-glowa">
            <h2>Pozycje</h2>
          </div>
          <div className="pw-tabela-kadr">
            <table className="pw-tabela">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th className="pw-do-prawej">Szt.</th>
                  {!pakujacy && <th className="pw-do-prawej">Cena</th>}
                  {!pakujacy && <th className="pw-do-prawej">Razem</th>}
                </tr>
              </thead>
              <tbody>
                {/* Ceny z chwili zakupu, nie z katalogu — `order_items` trzyma
                    własną kopię i to ona jest treścią umowy. */}
                {z.items.map((p) => (
                  <tr key={`${p.productId ?? 'usuniety'}-${p.name}`}>
                    <td>{p.name}</td>
                    <td className="pw-do-prawej num">{p.qty}</td>
                    {!pakujacy && <td className="pw-do-prawej num">{money(p.price)}</td>}
                    {!pakujacy && (
                      <td className="pw-do-prawej num">{money(p.price * p.qty)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
{!pakujacy && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Dostawa</td>
                  <td className="pw-do-prawej num">{z.shipping === 0 ? 'gratis' : money(z.shipping)}</td>
                </tr>
                {z.discount > 0 && (
                  <tr>
                    <td colSpan={3}>Rabat</td>
                    <td className="pw-do-prawej num">−{money(z.discount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3}>
                    <strong>Razem brutto</strong>
                  </td>
                  <td className="pw-do-prawej num">
                    <strong>{money(z.total)}</strong>
                  </td>
                </tr>
              </tfoot>
              )}
            </table>
          </div>
        </section>

        <section className="pw-sekcja">
          <div className="pw-sekcja-glowa">
            <h2>Klient i dostawa</h2>
          </div>
          <dl className="pw-dane">
            <dt>Klient</dt>
            <dd>{z.customer || '—'}</dd>
            {!pakujacy && (
              <>
                <dt>E-mail</dt>
                <dd>{z.email}</dd>
                <dt>Telefon</dt>
                <dd>{z.phone || '—'}</dd>
              </>
            )}
            <dt>Adres</dt>
            <dd>{z.address || '—'}</dd>
            <dt>Punkt odbioru</dt>
            <dd>{z.punktOdbioru ?? przesylka?.punktOdbioru ?? 'dostawa pod adres'}</dd>
            <dt>List przewozowy</dt>
            <dd className="num">{z.numerPrzesylki ?? '—'}</dd>
            <dt>Przewoźnik</dt>
            <dd>{przesylka?.przewoznik ?? '—'}</dd>
            <dt>Status u przewoźnika</dt>
            <dd>
              {przesylka?.status ? (
                <>
                  {przesylka.status}
                  <span className="muted">
                    {' '}
                    · odczyt {przesylka.statusOdczyt ? CZAS.format(new Date(przesylka.statusOdczyt)) : 'brak'}
                  </span>
                </>
              ) : (
                <span className="muted">brak danych</span>
              )}
            </dd>
            {!pakujacy && (
              <>
                <dt>Płatność</dt>
                <dd>
                  {z.paymentStatus}
                  {z.operatorPlatnosci && (
                    <span className="muted"> · {z.operatorPlatnosci}</span>
                  )}
                </dd>
              </>
            )}
          </dl>
        </section>
      </div>

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>Co się z nim działo</h2>
        </div>
        {slad.length === 0 ? (
          <p className="muted">
            Brak wpisów. Dziennik zapisuje zmiany od chwili wdrożenia — starsze zamówienia go nie mają.
          </p>
        ) : (
          <ul className="pw-lista">
            {slad.map((w) => (
              <li key={w.id} className="pw-wiersz">
                <span className="pw-wiersz-czas num">{CZAS.format(new Date(w.czas))}</span>
                <span className="pw-wiersz-tresc">{w.opis}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
