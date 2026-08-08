import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SzukajStanow } from '@/components/magazyn/SzukajStanow';
import { wymagajZaplecza } from '@/lib/magazyn-dostep';
import { getLicznikiMagazynu, getStanyMagazynu } from '@/lib/queries';
import { ile, POZYCJE } from '@/lib/odmiana';

export const metadata: Metadata = {
  title: 'Magazyn',
  description: 'Stany magazynowe.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const SEGMENTY = [
  { klucz: 'wszystko', etykieta: 'Wszystko' },
  { klucz: 'niskie', etykieta: 'Niskie' },
  { klucz: 'zero', etykieta: 'Zero' },
] as const;

type Segment = (typeof SEGMENTY)[number]['klucz'];

export default async function Stany({
  searchParams,
}: {
  searchParams: Promise<{ szukaj?: string; segment?: string }>;
}) {
  await wymagajZaplecza('/magazyn/stany');

  const { szukaj = '', segment: segmentZUrl } = await searchParams;
  const segment: Segment = SEGMENTY.some((s) => s.klucz === segmentZUrl)
    ? (segmentZUrl as Segment)
    : 'wszystko';

  const [produkty, liczniki] = await Promise.all([
    getStanyMagazynu(szukaj, segment),
    getLicznikiMagazynu(),
  ]);

  const parametry = (nowy: Segment) => {
    const p = new URLSearchParams();
    if (szukaj.trim()) p.set('szukaj', szukaj.trim());
    if (nowy !== 'wszystko') p.set('segment', nowy);
    const q = p.toString();
    return q ? `/magazyn/stany?${q}` : '/magazyn/stany';
  };

  const pustyKomunikat =
    segment === 'niskie'
      ? 'Brak pozycji poniżej progu'
      : segment === 'zero'
        ? 'Wszystko ma pokrycie w magazynie'
        : szukaj.trim()
          ? `Nic nie pasuje do „${szukaj.trim()}”`
          : 'Magazyn jest pusty';

  return (
    <main className="mag">
      <header className="mag-top">
        <h1>Magazyn</h1>
        <p className="mag-podtytul">{ile(liczniki.wszystko, POZYCJE)}</p>
      </header>

      <Suspense fallback={null}>
        <SzukajStanow startowa={szukaj} />
      </Suspense>

      <div className="mag-segmenty" role="tablist" aria-label="Filtr stanów">
        {SEGMENTY.map((s) => (
          <Link
            key={s.klucz}
            className="mag-segment"
            role="tab"
            aria-selected={s.klucz === segment}
            href={parametry(s.klucz)}
          >
            {s.etykieta}
            {s.klucz === 'niskie' && (
              <span className="mag-segment-licznik">{liczniki.niskie}</span>
            )}
          </Link>
        ))}
      </div>

      {produkty.length === 0 ? (
        <p className="mag-pusto">{pustyKomunikat}</p>
      ) : (
        <div className="mag-karta" style={{ marginTop: 10 }}>
          {produkty.map((p) => {
            const zero = p.stock === 0;
            const przyProgu = !zero && p.progNiski > 0 && p.stock <= p.progNiski;
            return (
              <Link key={p.id} className="mag-wiersz" href={`/magazyn/stany/${p.id}`}>
                <span
                  className={`mag-dioda${zero ? ' mag-dioda-brak' : przyProgu ? ' mag-dioda-uwaga' : ''}`}
                  aria-hidden="true"
                />
                <span className="mag-tresc">
                  <span className="mag-nazwa">{p.name}</span>
                  <span className="mag-meta">
                    {[p.sku ?? p.barcode, p.category].filter(Boolean).join(' · ')}
                    {przyProgu ? ` · próg ${p.progNiski}` : ''}
                  </span>
                </span>
                <span
                  className={`mag-odczyt${zero ? ' mag-odczyt-brak' : przyProgu ? ' mag-odczyt-uwaga' : ''}`}
                  aria-label={`Stan: ${p.stock} szt.`}
                >
                  {p.stock}
                </span>
                <span className="mag-szewron" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}

      <div className="mag-zapas" />
    </main>
  );
}
