import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nie ma takiej strony',
  robots: { index: false, follow: false },
};

/**
 * Adres, pod którym nic nie stoi.
 *
 * Bez tego pliku Next pokazuje własną stronę: czarny grotesk na białym tle,
 * po angielsku, bez nagłówka i bez drogi powrotnej. Wyglądało to jak awaria
 * serwera, a nie jak literówka w adresie — i było jedynym miejscem w sklepie
 * poza jego własnym językiem wizualnym.
 *
 * Komponent serwerowy: nie ma tu stanu ani zdarzenia, więc nie ma powodu
 * wysyłać do przeglądarki ani bajta JavaScriptu.
 */
export default function NotFound() {
  return (
    <main className="container section">
      <div className="empty">
        <span className="label">Błąd 404</span>
        <h1>Nie ma takiej strony</h1>
        <p>
          Adres jest nieaktualny albo wkradła się w niego literówka. Produkt mógł też zniknąć
          z katalogu — wtedy znajdziesz podobne w sklepie.
        </p>

        <Link className="btn" href="/sklep">
          Przejdź do sklepu
        </Link>

        <p style={{ marginTop: 28, marginBottom: 0 }}>
          <Link className="arrow-link" href="/">
            Wróć na stronę główną
          </Link>
        </p>
      </div>
    </main>
  );
}
