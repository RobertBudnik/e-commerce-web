import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="logo" href="/">
              Nordo
            </Link>
            <p>Sklep z elektroniką od 2019 roku. Ponad 120 000 zrealizowanych zamówień.</p>
          </div>
          <div>
            <h3>Sklep</h3>
            <ul>
              <li>
                <Link href="/sklep">Wszystkie produkty</Link>
              </li>
              <li>
                <Link href="/sklep?kategoria=audio">Audio</Link>
              </li>
              <li>
                <Link href="/sklep?kategoria=komputery">Komputery</Link>
              </li>
              <li>
                <Link href="/sklep?kategoria=foto">Foto</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Pomoc</h3>
            <ul>
              <li>
                <Link href="/konto#orders">Status zamówienia</Link>
              </li>
              <li>
                <Link href="/informacje/dostawa-i-platnosci">Dostawa i płatności</Link>
              </li>
              <li>
                <Link href="/informacje/zwroty-i-reklamacje">Zwroty i reklamacje</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Firma</h3>
            <ul>
              <li>
                <Link href="/pomoc">Pomoc i kontakt</Link>
              </li>
              <li>
                <Link href="/informacje/regulamin">Regulamin</Link>
              </li>
              <li>
                <Link href="/informacje/polityka-prywatnosci">Polityka prywatności</Link>
              </li>
              <li>
                <Link href="/informacje/odstapienie-od-umowy">Odstąpienie od umowy</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Nordo</span>
          <span>BLIK · Visa · Mastercard · Przelewy24</span>
        </div>
      </div>
    </footer>
  );
}
