import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SzukajStanow } from '@/components/magazyn/SzukajStanow';
import { SegmentyStanow } from '@/components/magazyn/SegmentyStanow';
import { wymagajZaplecza } from '@/lib/panel-dostep';
import { getLicznikiMagazynu, getOstatnieRuchy, getStanyMagazynu } from '@/lib/queries';
import { zeZnakiem } from '@/lib/format';
import { ile, POZYCJE } from '@/lib/odmiana';

export const metadata: Metadata = {
  title: 'Magazyn',
  description: 'Stany magazynowe.',
};

export const dynamic = 'force-dynamic';

const GODZINA = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

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
  await wymagajZaplecza('/panel/stany');

  const { szukaj = '', segment: segmentZUrl } = await searchParams;
  const segment: Segment = SEGMENTY.some((s) => s.klucz === segmentZUrl)
    ? (segmentZUrl as Segment)
    : 'wszystko';

  const [produkty, liczniki, ruchy] = await Promise.all([
    getStanyMagazynu(szukaj, segment),
    getLicznikiMagazynu(),
    getOstatnieRuchy(),
  ]);

  const parametry = (nowy: Segment) => {
    const p = new URLSearchParams();
    if (szukaj.trim()) p.set('szukaj', szukaj.trim());
    if (nowy !== 'wszystko') p.set('segment', nowy);
    const q = p.toString();
    return q ? `/panel/stany?${q}` : '/panel/stany';
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

      <SegmentyStanow
        aktywny={segment}
        segmenty={SEGMENTY.map((s) => ({
          klucz: s.klucz,
          etykieta: s.etykieta,
          href: parametry(s.klucz),
          licznik: s.klucz === 'niskie' ? liczniki.niskie : undefined,
        }))}
      />

      {produkty.length === 0 ? (
        <p className="mag-pusto">{pustyKomunikat}</p>
      ) : (
        <div className="mag-karta" style={{ marginTop: 10 }}>
          {produkty.map((p) => {
            const zero = p.stock === 0;
            const przyProgu = !zero && p.progNiski > 0 && p.stock <= p.progNiski;
            return (
              <Link key={p.id} className="mag-wiersz" href={`/panel/stany/${p.id}`}>
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

      {/* Historia przyjechała tu z przeglądu magazynu, który po scaleniu zniknął.
          Stany są jej naturalnym miejscem: liczba bez historii jest tylko
          liczbą, a magazynier czyta ją, żeby wiedzieć, skąd się wzięła
          i czy to on ją ruszył. */}
      {ruchy.length > 0 && (
        <>
          <h2 className="mag-sekcja">Ostatnie ruchy</h2>
          <div className="mag-karta">
            {ruchy.map((ruch) => (
              <Link
                key={ruch.id}
                className="mag-wiersz"
                href={`/panel/stany/${ruch.produktId}`}
              >
                <span className="mag-tresc">
                  <span className="mag-nazwa">{ruch.produkt}</span>
                  <span className="mag-meta">
                    {ruch.powod} · {GODZINA.format(new Date(ruch.czas))}
                  </span>
                </span>
                <span
                  className={`mag-delta ${ruch.delta > 0 ? 'mag-delta-plus' : 'mag-delta-minus'}`}
                >
                  {zeZnakiem(ruch.delta)}
                  <span className="mag-delta-jednostka"> szt.</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mag-zapas" />
    </main>
  );
}
