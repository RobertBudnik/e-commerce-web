import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { CartProvider } from '@/components/cart/CartProvider';
import { MiniCart } from '@/components/cart/MiniCart';
import { QuickViewHost } from '@/components/product/QuickViewHost';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ToastHost } from '@/components/ui/ToastHost';
import { SladKursora } from '@/components/ruch/SladKursora';
import { OdsloniecieStopki } from '@/components/ruch/OdsloniecieStopki';
import { WishlistProvider } from '@/components/product/WishlistProvider';
import { headers } from 'next/headers';
import { getSessionUser } from '@/lib/queries';
import { MARKA } from '@/lib/dane-sklepu';
import { siteUrl } from '@/lib/site';

/**
 * Kroje ładuje `next/font`: pliki serwuje własna domena, więc znika request
 * do Google i skok układu przy zamianie fontu zastępczego.
 * Subset latin-ext jest obowiązkowy — polskie znaki.
 */
/**
 * KokonutUI nie ma szeryfa. Cały serwis — nagłówki, interfejs, etykiety —
 * jedzie jednym krojem Geist; różnicę robi stopień i waga, nie zmiana pisma.
 * Zmienna `--font-display` zostaje pod tą samą nazwą, bo wisi na niej kilkaset
 * odwołań w `globals.css`; wskazuje teraz na ten sam krój co interfejs.
 */
const display = Geist({
  subsets: ['latin-ext'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Geist({
  subsets: ['latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

/** Geist Mono pod liczby, które mają stać w kolumnie: tabele i kwoty. */
const mono = Geist_Mono({
  subsets: ['latin-ext'],
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
    var pytanie = matchMedia('(prefers-color-scheme: dark)');
    var ciemny = zapis === 'dark' || (zapis !== 'light' && pytanie.matches);
    if (ciemny) document.documentElement.classList.add('dark');

    // Ustawienie systemu potrafi zmienić się przy działającej stronie —
    // w powłoce na telefonie o zmierzchu robi to sam iOS. Bez nasłuchu strona
    // zostawała w motywie z chwili wczytania: system ciemny, sklep jasny.
    // Zapis użytkownika wygrywa, więc kto wybrał motyw ręcznie, ten go trzyma.
    pytanie.addEventListener('change', function (e) {
      if (localStorage.getItem('nordo-theme')) return;
      document.documentElement.classList.toggle('dark', e.matches);
    });

    // Skrót z ekranu początkowego to też aplikacja, tylko uruchamiana przez
    // Safari — nie niesie więc User-Agenta powłoki i serwer nie ma po czym
    // jej poznać. Bez tego magazyn otwarty z ikony dostawał wygląd strony:
    // nadtytuł, szeryfowy nagłówek i pasek zakładek w HTML-u, mimo że pasek
    // adresu był schowany. Klasa jest ta sama, więc reguły powłoki obejmują
    // obie drogi bez dublowania.
    if (matchMedia('(display-mode: standalone)').matches) {
      document.documentElement.classList.add('w-aplikacji');
    }
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

  /**
   * iOS nie czyta ikon z manifestu — kafel na ekranie początkowym bierze
   * wyłącznie z `apple-touch-icon`. Bez tego Safari wstawia zrzut strony.
   */
  appleWebApp: {
    capable: true,
    title: MARKA.nazwa,
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
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
  // Blokada powiększania szczypaniem byłaby wygodna przy skanowaniu, ale
  // odbiera możliwość powiększenia komuś, kto tego potrzebuje.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesja czytana raz, w layoucie — nagłówek i strony dostają ją bez
  // dodatkowego zapytania, a token weryfikuje Auth, nie przeglądarka.
  const user = await getSessionUser();

  // Magazyn ma dwie twarze i to jest świadome:
  //
  //   w przeglądarce — zwykła podstrona sklepu. Nagłówek, stopka, ta sama
  //     typografia i to samo tło. Ktoś, kto wchodzi tu z laptopa, porusza się
  //     po jednym serwisie, a nie po dwóch różnych aplikacjach pod jednym
  //     adresem, i musi mieć jak wrócić do sklepu.
  //
  //   w powłoce — przyrząd. Bez nagłówka z koszykiem, bez stopki
  //     z regulaminem, systemowy krój, kadr od krawędzi do krawędzi.
  //     Tam magazyn jest całą aplikacją, więc nawigacja sklepu tylko
  //     zabierałaby miejsce.
  //
  // Rozróżnia je wyłącznie `wAplikacji`, nie ścieżka.
  const naglowki = await headers();

  // Treść jedzie do natywnej powłoki? Wtedy pasek zakładek jest już na dole
  // ekranu, narysowany przez system — powtarzanie go w HTML-u byłoby dublem.
  const wAplikacji = (naglowki.get('user-agent') ?? '').includes('NordoApp');

  // `w-aplikacji` obejmuje też skrót z ekranu początkowego, a tam nie ma
  // natywnego paska zakładek. Osobna klasa dla powłoki pozwala zarezerwować
  // miejsce pod paskiem wyłącznie tam, gdzie ten pasek naprawdę jest.
  const klasy = [
    display.variable,
    sans.variable,
    mono.variable,
    wAplikacji ? 'w-aplikacji w-powloce' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <html lang="pl" className={klasy} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_MOTYWU }} />
      </head>
      <body>
        <CartProvider>
          <WishlistProvider signedIn={Boolean(user)}>
            {/* Odnośnik do treści. Bez niego klawiatura przechodzi na każdej
                podstronie przez cały nagłówek — logo, cztery pozycje menu,
                motyw, konto i koszyk — zanim dotrze do tego, po co ktoś
                przyszedł. Widoczny dopiero na fokusie, więc mysz go nie widzi. */}
            {!wAplikacji && (
              <a className="skip-link" href="#tresc">
                Przejdź do treści
              </a>
            )}
            {!wAplikacji && <SiteHeader user={user} />}
            <div id="tresc" tabIndex={-1}>
              {children}
            </div>
            {!wAplikacji && <SiteFooter />}
            {!wAplikacji && <OdsloniecieStopki />}
            <MiniCart />
            <QuickViewHost />
            <ToastHost />
            {/* Ślad kursora nic nie renderuje przy ograniczonym ruchu ani
                na dotyku, a w powłoce aplikacji nie ma go wcale. */}
            {!wAplikacji && <SladKursora />}
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
