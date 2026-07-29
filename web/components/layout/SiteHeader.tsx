import Link from 'next/link';
import type { SessionUser } from '@/lib/types';
import { AccountMenu } from './AccountMenu';
import { CartButton } from '@/components/cart/CartButton';

/**
 * Nagłówek renderuje się na serwerze — stan zalogowania jest w pierwszym
 * HTML-u, więc menu konta nie mruga po hydratacji.
 */
export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="logo" href="/">
          Nordo
        </Link>
        <nav className="nav">
          <Link href="/">Start</Link>
          <Link href="/sklep">Sklep</Link>
        </nav>
        <div className="header-actions">
          <AccountMenu user={user} />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
