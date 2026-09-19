import Link from 'next/link';
import { MARKA, PLATNOSCI, SPRZEDAWCA, doUzupelnienia } from '@/lib/dane-sklepu';

/**
 * Stopka niesie dane identyfikujące sprzedawcę — przy sprzedaży konsumenckiej
 * muszą być dostępne w sposób stały i łatwy, więc stoją tu, a nie wyłącznie
 * w regulaminie. Treść pochodzi z `web/lib/dane-sklepu.ts`; dopóki pola noszą
 * znacznik `⟨…⟩`, stopka mówi wprost, czego brakuje, zamiast udawać komplet.
 */
export function SiteFooter() {
  const brakDanych = [SPRZEDAWCA.nazwa, SPRZEDAWCA.adres, SPRZEDAWCA.nip].some(doUzupelnienia);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="logo" href="/">
              {MARKA.nazwa}
            </Link>
            <p>{MARKA.opisStopki}</p>
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
                <Link href="/pomoc">FAQ</Link>
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

        <p className="footer-sprzedawca muted">
          {brakDanych ? (
            <>Dane sprzedawcy do wpisania w <code>web/lib/dane-sklepu.ts</code> → <code>SPRZEDAWCA</code>:{' '}</>
          ) : null}
          {[SPRZEDAWCA.nazwa, SPRZEDAWCA.adres, `NIP ${SPRZEDAWCA.nip}`, SPRZEDAWCA.regon && `REGON ${SPRZEDAWCA.regon}`, SPRZEDAWCA.krs]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {MARKA.nazwa}
          </span>
          {PLATNOSCI.length > 0 && <span>{PLATNOSCI.join(' · ')}</span>}
        </div>
      </div>
    </footer>
  );
}
