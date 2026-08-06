import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AkcjeZamowienia } from '@/components/magazyn/AkcjeZamowienia';
import { wymagajZaplecza } from '@/lib/magazyn-dostep';
import { getZamowienieZPokryciem } from '@/lib/queries';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Zamówienie',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function Zamowienie({
  params,
  searchParams,
}: {
  params: Promise<{ numer: string }>;
  searchParams: Promise<{ stan?: string }>;
}) {
  const { numer } = await params;
  const { stan: stanZUrl } = await searchParams;

  await wymagajZaplecza(`/magazyn/zamowienia/${numer}`);

  const dane = await getZamowienieZPokryciem(decodeURIComponent(numer));
  if (!dane) notFound();

  const { zamowienie, pozycje } = dane;
  const powrot = `/magazyn/zamowienia?stan=${encodeURIComponent(stanZUrl ?? 'nowe')}`;

  return (
    <main className="mag">
      <Link className="mag-powrot" href={powrot}>
        Zamówienia
      </Link>

      <header className="mag-top">
        <h1 style={{ fontFamily: 'var(--mono)', fontSize: 24, letterSpacing: 0 }}>
          {zamowienie.number}
        </h1>
        <p style={{ margin: '8px 0 0' }}>
          <span className="mag-pigulka">{zamowienie.status}</span>
        </p>
      </header>

      <h2 className="mag-sekcja">Pozycje</h2>
      <div className="mag-karta">
        {pozycje.map((p, i) => (
          <div className="mag-wiersz" key={`${p.productId ?? 'brak'}-${i}`}>
            <span
              className={`mag-dioda${p.brakuje > 0 ? ' mag-dioda-uwaga' : ''}`}
              aria-hidden="true"
            />
            <span className="mag-tresc">
              <span className="mag-nazwa">{p.name}</span>
              <span className={`mag-meta${p.brakuje > 0 ? ' mag-meta-brak' : ''}`}>
                {[p.sku, `stan ${p.stan} szt.`].filter(Boolean).join(' · ')}
                {p.brakuje > 0 ? ` · brakuje ${p.brakuje}` : ''}
              </span>
            </span>
            <span className="mag-odczyt">× {p.qty}</span>
          </div>
        ))}
      </div>

      <h2 className="mag-sekcja">Dostawa</h2>
      <div className="mag-karta">
        <dl className="mag-dane">
          <div>
            <dt>Odbiorca</dt>
            <dd>{zamowienie.customer}</dd>
          </div>
          <div>
            <dt>Adres</dt>
            <dd>{zamowienie.address || '—'}</dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd className="mono">{zamowienie.phone || '—'}</dd>
          </div>
          {zamowienie.numerPrzesylki && (
            <div>
              <dt>List przewozowy</dt>
              {/* Numer musi dać się skopiować jednym dotknięciem — reszta
                  interfejsu w powłoce ma zaznaczanie wyłączone. */}
              <dd className="mono" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                {zamowienie.numerPrzesylki}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <h2 className="mag-sekcja">Płatność</h2>
      <div className="mag-karta">
        <dl className="mag-dane">
          <div>
            <dt>Status</dt>
            <dd>
              {zamowienie.paymentStatus}
              {zamowienie.operatorPlatnosci ? ` · ${zamowienie.operatorPlatnosci}` : ''}
            </dd>
          </div>
          <div>
            <dt>Kwota</dt>
            <dd className="mono" style={{ fontSize: 17, fontWeight: 600 }}>
              {money(zamowienie.total)}
            </dd>
          </div>
        </dl>
      </div>

      <AkcjeZamowienia
        zamowienieId={zamowienie.id}
        stan={zamowienie.status}
        numerPrzesylki={zamowienie.numerPrzesylki}
      />
    </main>
  );
}
