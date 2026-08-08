import Link from 'next/link';
import type { SessionUser } from '@/lib/types';
import { AccountMenu } from './AccountMenu';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';
import { CartButton } from '@/components/cart/CartButton';
import { storeModeZeSrodowiska } from '@/lib/store-mode';
import { MARKA } from '@/lib/dane-sklepu';

/**
 * Nagłówek renderuje się na serwerze — stan zalogowania jest w pierwszym
 * HTML-u, więc menu konta nie mruga po hydratacji.
 *
 * W trybie `single` pozycja „Sklep" znika: prowadziłaby do przekierowania
 * z powrotem na stronę główną, a link donikąd jest gorszy niż jego brak.
 */
export function SiteHeader({ user }: { user: SessionUser | null }) {
  const tryb = storeModeZeSrodowiska();

  // „Opinie" wrócą tu razem z sekcją opinii. Pozycja prowadząca do kotwicy,
  // której nie ma, jest gorsza niż jej brak — sklep nie ma dziś tabeli opinii,
  // a wpisywanie zmyślonych na działającym sklepie wprowadzałoby klientów w błąd.
  const pozycje = [
    { href: '/', label: 'Start' },
    ...(tryb === 'catalog' ? [{ href: '/sklep', label: 'Sklep' }] : []),
    { href: '/pomoc', label: 'Pomoc' },
  ];

  return (
    <header className="site-header">
      <div className="container header-inner">
        <MobileNav pozycje={pozycje} />

        <Link className="logo" href="/">
          {MARKA.nazwa}
        </Link>

        <nav className="nav" aria-label="Główna">
          {pozycje.map((p) => (
            <Link key={p.href} href={p.href}>
              {p.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <AccountMenu user={user} />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
