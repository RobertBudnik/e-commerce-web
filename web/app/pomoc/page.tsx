import type { Metadata } from 'next';
import Link from 'next/link';
import { SLUGI_INFO, STRONY_INFO } from '@/lib/strony-informacyjne';

export const metadata: Metadata = {
  title: 'Pomoc',
  description: 'Dostawa, zwroty, reklamacje i kontakt ze sklepem Nordo.',
};

export default function Pomoc() {
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
        <p>
          Nie znalazłeś odpowiedzi? Napisz — odpowiadamy w dni robocze, zwykle
          tego samego dnia.
        </p>
        <aside className="doc-todo">
          <p className="label">Do uzupełnienia przed startem sprzedaży</p>
          <ul>
            <li>Adres e-mail i telefon obsługi klienta</li>
            <li>Godziny pracy działu obsługi</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
