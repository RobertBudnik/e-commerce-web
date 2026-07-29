import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

import { CartProvider } from '@/components/cart/CartProvider';
import { MiniCart } from '@/components/cart/MiniCart';
import { QuickViewHost } from '@/components/product/QuickViewHost';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ToastHost } from '@/components/ui/ToastHost';
import { WishlistProvider } from '@/components/product/WishlistProvider';
import { getSessionUser } from '@/lib/queries';

/**
 * Kroje ładuje `next/font`: pliki serwuje własna domena, więc znika request
 * do Google i skok układu przy zamianie fontu zastępczego.
 * Subset latin-ext jest obowiązkowy — polskie znaki.
 */
const display = Fraunces({
  subsets: ['latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'),
  title: {
    default: 'Nordo — sklep z elektroniką',
    template: '%s — Nordo',
  },
  description: 'Wąski, przemyślany wybór sprzętu. Darmowa dostawa od 300 zł, trzydzieści dni na zwrot.',
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    siteName: 'Nordo',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesja czytana raz, w layoucie — nagłówek i strony dostają ją bez
  // dodatkowego zapytania, a token weryfikuje Auth, nie przeglądarka.
  const user = await getSessionUser();

  return (
    <html lang="pl" className={`${display.variable} ${sans.variable}`}>
      <body>
        <CartProvider>
          <WishlistProvider signedIn={Boolean(user)}>
            <SiteHeader user={user} />
            {children}
            <SiteFooter />
            <MiniCart />
            <QuickViewHost />
            <ToastHost />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
