import type { Metadata } from 'next';
import Link from 'next/link';
import { SLUGI_INFO, STRONY_INFO } from '@/lib/strony-informacyjne';
import { SPRZEDAWCA, doUzupelnienia } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Pomoc',
  description: 'Dostawa, zwroty, reklamacje i kontakt ze sklepem Nordo.',
};

export default function Pomoc() {
  const brakKontaktu = [SPRZEDAWCA.email, SPRZEDAWCA.telefon, SPRZEDAWCA.godziny].some(doUzupelnienia);

  return (
    <main className="container doc">
      <nav className="crumbs" aria-label="Ścieżka">
        <Link href="/">Start</Link>
        <span aria-hidden="true">/</span>
        <span>Pomoc</span>
      </nav>

      <h1>Pomoc</h1>
      <p className="doc-lead">
        Najczęstsze sprawy załatwisz sam — poniżej wszystko, co dotyczy zamówienia,
        dostawy i zwrotu.
      </p>

      <div className="doc-links">
        {SLUGI_INFO.map((slug) => (
          <Link key={slug} href={`/informacje/${slug}`} className="doc-link">
            <span className="doc-link-title">{STRONY_INFO[slug].tytul}</span>
            <span className="doc-link-desc">{STRONY_INFO[slug].wstep}</span>
          </Link>
        ))}
      </div>

      <section className="doc-section">
        <h2>Kontakt</h2>
        {brakKontaktu ? (
          <p>
            Dane kontaktowe wpisz w <code>web/lib/dane-sklepu.ts</code> →{' '}
            <code>SPRZEDAWCA</code> (<code>email</code>, <code>telefon</code>,{' '}
            <code>godziny</code>). Przy sprzedaży konsumenckiej muszą być dostępne
            w sposób stały i łatwy.
          </p>
        ) : (
          <p>
            Napisz na <a href={`mailto:${SPRZEDAWCA.email}`}>{SPRZEDAWCA.email}</a> albo zadzwoń
            pod {SPRZEDAWCA.telefon}. Pracujemy {SPRZEDAWCA.godziny}.
          </p>
        )}
      </section>
    </main>
  );
}
