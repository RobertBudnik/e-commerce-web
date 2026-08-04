import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from 'next/font/google';
import './globals.css';

import { CartProvider } from '@/components/cart/CartProvider';
import { MiniCart } from '@/components/cart/MiniCart';
import { QuickViewHost } from '@/components/product/QuickViewHost';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ToastHost } from '@/components/ui/ToastHost';
import { WishlistProvider } from '@/components/product/WishlistProvider';
import { getSessionUser } from '@/lib/queries';
import { siteUrl } from '@/lib/site';

/**
 * Kroje ładuje `next/font`: pliki serwuje własna domena, więc znika request
 * do Google i skok układu przy zamianie fontu zastępczego.
 * Subset latin-ext jest obowiązkowy — polskie znaki.
 */
const display = Instrument_Serif({
  subsets: ['latin-ext'],
  weight: ['400'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Instrument_Sans({
  subsets: ['latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

/** Etykiety techniczne: nadtytuły, kategorie na kartach, nagłówki w stopce. */
const mono = IBM_Plex_Mono({
  subsets: ['latin-ext'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * Skrypt blokujący — musi wykonać się przed pierwszym malowaniem, inaczej
 * wchodząc w ciemnym motywie zobaczysz mignięcie jasnego tła. Dlatego leci
 * inline w <head>, a nie przez komponent kliencki.
 *
 * Kolejność źródeł: zapis użytkownika, potem ustawienie systemu.
 */
const SKRYPT_MOTYWU = `
(function () {
  try {
    var zapis = localStorage.getItem('nordo-theme');
    var ciemny = zapis === 'dark' ||
      (zapis !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (ciemny) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
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

  /**
   * iOS nie czyta ikon z manifestu — kafel na ekranie początkowym bierze
   * wyłącznie z `apple-touch-icon`. Bez tego Safari wstawia zrzut strony.
   */
  appleWebApp: {
    capable: true,
    title: 'Nordo',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

/**
 * Pasek stanu telefonu dostaje kolor tła aplikacji — inaczej w ciemnym
 * motywie zostaje jasny pasek nad ciemną treścią.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
  // Blokada powiększania szczypaniem byłaby wygodna przy skanowaniu, ale
  // odbiera możliwość powiększenia komuś, kto tego potrzebuje.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesja czytana raz, w layoucie — nagłówek i strony dostają ją bez
  // dodatkowego zapytania, a token weryfikuje Auth, nie przeglądarka.
  const user = await getSessionUser();

  return (
    <html lang="pl" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_MOTYWU }} />
      </head>
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
