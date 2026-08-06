import type { Metadata } from 'next';
import Link from 'next/link';
import { PrzyjmijZwrot } from '@/components/magazyn/PrzyjmijZwrot';
import { wymagajZaplecza } from '@/lib/magazyn-dostep';
import { getZwroty } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Zwroty',
  description: 'Zwroty czekające na przyjęcie.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DATA = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' });

export default async function Zwroty() {
  await wymagajZaplecza('/magazyn/zwroty');
  const zwroty = await getZwroty();

  return (
    <main className="mag">
      <Link className="mag-powrot" href="/magazyn">
        Przegląd
      </Link>

      <header className="mag-top">
        <h1>Zwroty</h1>
        <p className="mag-podtytul">
          {zwroty.length === 0 ? 'nic nie czeka' : `${zwroty.length} do przyjęcia`}
        </p>
      </header>

      {zwroty.length === 0 ? (
        <p className="mag-pusto">Brak zwrotów do przyjęcia</p>
      ) : (
        zwroty.map((z) => (
          <section key={z.id} className="mag-karta" style={{ marginTop: 10 }}>
            <div className="mag-wiersz">
              <span className="mag-dioda mag-dioda-zero" aria-hidden="true" />
              <span className="mag-tresc">
                <span className="mag-odczyt-maly" style={{ display: 'block' }}>
                  {z.numerZamowienia}
                </span>
                <span className="mag-nazwa">{z.klient}</span>
                <span className="mag-meta">
                  zgłoszony {DATA.format(new Date(z.zgloszony))}
                  {z.powod ? ` · ${z.powod}` : ''}
                </span>
              </span>
            </div>

            {z.pozycje.map((p, i) => (
              <div className="mag-wiersz" key={`${z.id}-${i}`}>
                <span className="mag-tresc">
                  <span className="mag-nazwa">{p.name}</span>
                </span>
                <span className="mag-odczyt">× {p.qty}</span>
              </div>
            ))}

            <div style={{ padding: '12px 14px' }}>
              <PrzyjmijZwrot zwrotId={z.id} sztuk={z.sztuk} />
            </div>
          </section>
        ))
      )}

      <div className="mag-zapas" />
    </main>
  );
}
