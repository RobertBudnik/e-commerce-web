import type { Metadata } from 'next';
import Link from 'next/link';
import { wymagajZaplecza } from '@/lib/magazyn-dostep';
import { getKolejkaZamowien, getLicznikiZamowien } from '@/lib/queries';
/* W kolejce waluta jest ta sama w każdym wierszu, więc powtarzanie „zł"
   trzydzieści razy tylko zabiera miejsce liczbie. Symbol wraca na karcie
   zamówienia, gdzie kwota jest pojedyncza i ma wagę. */
const KWOTA = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const metadata: Metadata = {
  title: 'Zamówienia',
  description: 'Kolejka wysyłek.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const GODZINA = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

const ZAKLADKI = [
  { klucz: 'nowe', etykieta: 'Nowe' },
  { klucz: 'spakowane', etykieta: 'Spakowane' },
  { klucz: 'wysłane', etykieta: 'Wysłane' },
] as const;

type Stan = (typeof ZAKLADKI)[number]['klucz'];

/** Sposób dostawy siedzi w adresie jako punkt albo miasto — nazwa dla wiersza. */
function sposobDostawy(adres: string): string {
  if (!adres) return 'dostawa nieokreślona';
  return adres.length > 28 ? `${adres.slice(0, 27)}…` : adres;
}

export default async function Zamowienia({
  searchParams,
}: {
  searchParams: Promise<{ stan?: string }>;
}) {
  await wymagajZaplecza('/magazyn/zamowienia');

  const { stan: stanZUrl } = await searchParams;
  const stan: Stan = ZAKLADKI.some((z) => z.klucz === stanZUrl) ? (stanZUrl as Stan) : 'nowe';

  const [zamowienia, liczniki] = await Promise.all([
    getKolejkaZamowien(stan),
    getLicznikiZamowien(),
  ]);

  return (
    <main className="mag">
      <header className="mag-top">
        <h1>Zamówienia</h1>
      </header>

      {/* Stan zakładki siedzi w adresie, więc powrót z karty zamówienia
          wraca do tej samej listy, a nie do domyślnej. */}
      <div className="mag-segmenty" role="tablist" aria-label="Stan zamówień">
        {ZAKLADKI.map((z) => (
          <Link
            key={z.klucz}
            className="mag-segment"
            role="tab"
            aria-selected={z.klucz === stan}
            href={`/magazyn/zamowienia?stan=${encodeURIComponent(z.klucz)}`}
          >
            {z.etykieta}
            <span className="mag-segment-licznik">{liczniki[z.klucz] ?? 0}</span>
          </Link>
        ))}
      </div>

      {zamowienia.length === 0 ? (
        <p className="mag-pusto">Brak zamówień w tej zakładce</p>
      ) : (
        <div className="mag-karta" style={{ marginTop: 10 }}>
          {zamowienia.map((z) => {
            const brak = z.brakujeSztuk > 0;
            return (
              <Link
                key={z.id}
                className="mag-wiersz"
                href={`/magazyn/zamowienia/${encodeURIComponent(z.number)}?stan=${stan}`}
              >
                <span
                  className={`mag-dioda${brak ? ' mag-dioda-uwaga' : stan === 'wysłane' ? ' mag-dioda-zero' : ''}`}
                  aria-hidden="true"
                />
                <span className="mag-tresc">
                  <span className="mag-odczyt-maly" style={{ display: 'block' }}>
                    {z.number}
                  </span>
                  <span className="mag-nazwa">{z.customer}</span>
                  <span className={`mag-meta${brak ? ' mag-meta-brak' : ''}`}>
                    {brak
                      ? `brak ${z.brakujeSztuk} szt. ${z.brakujacyProdukt} w magazynie`
                      : `${z.items.length} pozycji · ${sposobDostawy(z.address)}`}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flex: 'none' }}>
                  <span className="mag-odczyt" style={{ fontSize: 15, display: 'block' }}>
                    {KWOTA.format(z.total)}
                  </span>
                  <span className="mag-segment-licznik">{GODZINA.format(new Date(z.date))}</span>
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
