import type { Metadata, Viewport } from 'next';
import './globals.css';

import { CartProvider } from '@/components/cart/CartProvider';
import { MiniCart } from '@/components/cart/MiniCart';
import { QuickViewHost } from '@/components/product/QuickViewHost';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ToastHost } from '@/components/ui/ToastHost';
import { OdsloniecieStopki } from '@/components/ruch/OdsloniecieStopki';
import { WishlistProvider } from '@/components/product/WishlistProvider';
import { headers } from 'next/headers';
import { NAGLOWEK_NONCE } from '@/lib/csp';
import { KLUCZ_MOTYWU, KLUCZ_MOTYWU_STARY } from '@/lib/klucze';
import { getSessionUser } from '@/lib/queries';
import { MARKA } from '@/lib/dane-sklepu';
import { siteUrl } from '@/lib/site';

/**
 * Kroje idą z systemu (SF na Apple, Segoe/Roboto indziej) — definicje
 * `--font-sans` / `--font-display` / `--font-mono` siedzą w `globals.css`.
 * Bez `next/font`: zero requestów do Google i zero skoku układu.
 */

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
    var czytaj = function () {
      return localStorage.getItem('${KLUCZ_MOTYWU}')
        || localStorage.getItem('${KLUCZ_MOTYWU_STARY}');
    };
    var zapis = czytaj();
    var pytanie = matchMedia('(prefers-color-scheme: dark)');
    var ciemny = zapis === 'dark' || (zapis !== 'light' && pytanie.matches);
    if (ciemny) document.documentElement.classList.add('dark');

    // Ustawienie systemu potrafi zmienić się przy działającej stronie — bez
    // nasłuchu strona zostawała w motywie z chwili wczytania: system ciemny,
    // sklep jasny. Zapis użytkownika wygrywa, więc kto wybrał motyw ręcznie,
    // ten go trzyma.
    pytanie.addEventListener('change', function (e) {
      if (czytaj()) return;
      document.documentElement.classList.toggle('dark', e.matches);
    });
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: MARKA.tytulKarty,
    template: `%s — ${MARKA.nazwa}`,
  },
  description: MARKA.opisMeta,
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    siteName: MARKA.nazwa,
  },

  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

/**
 * Pasek stanu telefonu dostaje kolor tła strony — inaczej w ciemnym
 * motywie zostaje jasny pasek nad ciemną treścią.
 */
export const viewport: Viewport = {
  themeColor: [
    // Trzymaj zgodnie z `--bg` w `globals.css` — te dwie wartości są jedynym
    // miejscem, gdzie tło strony powtarza się poza arkuszem.
    { media: '(prefers-color-scheme: light)', color: '#ece9e1' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1917' },
  ],
  // Blokada powiększania szczypaniem byłaby wygodna przy skanowaniu, ale
  // odbiera możliwość powiększenia komuś, kto tego potrzebuje.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesja czytana raz, w layoucie — nagłówek i strony dostają ją bez
  // dodatkowego zapytania, a token weryfikuje Auth, nie przeglądarka.
  const user = await getSessionUser();

  // Magazyn to zwykła podstrona sklepu: nagłówek, stopka, ta sama typografia
  // i to samo tło. Ktoś, kto wchodzi tu z laptopa, porusza się po jednym
  // serwisie i musi mieć jak wrócić do sklepu.
  const naglowki = await headers();
  const nonce = naglowki.get(NAGLOWEK_NONCE) ?? undefined;

  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        {/* Nonce z middleware. Bez niego polityka odrzuci ten skrypt, a wraz
            z nim zniknie jedyne, co ratuje przed mignięciem jasnego tła przy
            wejściu w motywie ciemnym.

            `suppressHydrationWarning` jest tu konieczne, nie kosmetyczne:
            React świadomie nie przesyła nonce'a do przeglądarki, więc po
            stronie serwera atrybut ma wartość, a po stronie klienta jest
            pusty. Bez tłumienia każde wejście na dowolną stronę wypisuje
            w konsoli ostrzeżenie o rozjeździe hydratacji — czyli szum, który
            z czasem przykrywa prawdziwe rozjazdy. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: SKRYPT_MOTYWU }}
        />
      </head>
      <body>
        <CartProvider>
          <WishlistProvider signedIn={Boolean(user)}>
            {/* Odnośnik do treści. Bez niego klawiatura przechodzi na każdej
                podstronie przez cały nagłówek — logo, cztery pozycje menu,
                motyw, konto i koszyk — zanim dotrze do tego, po co ktoś
                przyszedł. Widoczny dopiero na fokusie, więc mysz go nie widzi. */}
            <a className="skip-link" href="#tresc">
              Przejdź do treści
            </a>
            <SiteHeader user={user} />
            <div id="tresc" tabIndex={-1}>
              {children}
            </div>
            <SiteFooter />
            <OdsloniecieStopki />
            <MiniCart />
            <QuickViewHost />
            <ToastHost />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
