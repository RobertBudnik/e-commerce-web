import type { Metadata } from 'next';
import Link from 'next/link';
import { wymagajZaplecza } from '@/lib/panel-dostep';
import { getPrzeglad } from '@/lib/queries';
import { zeZnakiem } from '@/lib/format';
import { MotywAplikacji } from '@/components/magazyn/MotywAplikacji';

export const metadata: Metadata = {
  title: 'Przegląd',
  description: 'Stan magazynu i kolejka wysyłek.',
};

/** Liczby zmieniają się przy każdym zamówieniu — nic tu nie może iść z cache. */
export const dynamic = 'force-dynamic';

const DATA = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' });
const GODZINA = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

export default async function Przeglad() {
  await wymagajZaplecza('/magazyn');
  const dane = await getPrzeglad();

  return (
    <main className="mag">
      <header className="mag-top">
        <h1>Przegląd</h1>
        <p className="mag-podtytul">{DATA.format(new Date())}</p>
      </header>

      <div className="mag-karta" style={{ marginTop: 12 }}>
        <Link className="mag-wiersz" href="/magazyn/zamowienia?stan=nowe">
          <span className="mag-dioda" style={{ background: 'var(--accent)' }} aria-hidden="true" />
          <span className="mag-tresc">
            <span className="mag-nazwa">Do wysłania</span>
          </span>
          <span className="mag-odczyt">{dane.doWyslania}</span>
          <span className="mag-szewron" aria-hidden="true" />
        </Link>

        <Link className="mag-wiersz" href="/magazyn/stany?segment=niskie">
          <span className="mag-dioda mag-dioda-uwaga" aria-hidden="true" />
          <span className="mag-tresc">
            <span className="mag-nazwa">Niskie stany</span>
          </span>
          <span className="mag-odczyt">{dane.niskieStany}</span>
          <span className="mag-szewron" aria-hidden="true" />
        </Link>

        <Link className="mag-wiersz" href="/magazyn/zwroty">
          <span className="mag-dioda mag-dioda-neutralna" aria-hidden="true" />
          <span className="mag-tresc">
            <span className="mag-nazwa">Zwroty do przyjęcia</span>
          </span>
          <span className="mag-odczyt">{dane.zwroty}</span>
          <span className="mag-szewron" aria-hidden="true" />
        </Link>
      </div>

      <h2 className="mag-sekcja">Dzisiaj</h2>
      <div className="mag-kafle">
        <div className="mag-kafel">
          <span className="mag-kafel-liczba">{dane.paczkiDzis}</span>
          <span className="mag-kafel-opis">wysłanych paczek</span>
        </div>
        <div className="mag-kafel">
          <span className="mag-kafel-liczba">{dane.sztukiDzis}</span>
          <span className="mag-kafel-opis">przyjętych sztuk</span>
        </div>
      </div>

      <h2 className="mag-sekcja">Ostatnie ruchy</h2>
      {dane.ruchy.length === 0 ? (
        <p className="mag-pusto">Brak ruchów dzisiaj</p>
      ) : (
        <div className="mag-karta">
          {dane.ruchy.map((ruch) => (
            <Link
              key={ruch.id}
              className="mag-wiersz"
              href={`/magazyn/stany/${ruch.produktId}`}
            >
              <span className="mag-tresc">
                <span className="mag-nazwa">{ruch.produkt}</span>
                <span className="mag-meta">
                  {ruch.powod} · {GODZINA.format(new Date(ruch.czas))}
                </span>
              </span>
              <span className={`mag-delta ${ruch.delta > 0 ? 'mag-delta-plus' : 'mag-delta-minus'}`}>
                {zeZnakiem(ruch.delta)}
                <span className="mag-delta-jednostka"> szt.</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Ustawienie urządzenia, nie treść pracy — więc na końcu przeglądu,
          pod tym, po co magazynier tu wchodzi. Osobnej zakładki nie zakłada,
          bo jedno ustawienie nie jest ekranem. */}
      <MotywAplikacji />

      <div className="mag-zapas" />
    </main>
  );
}
