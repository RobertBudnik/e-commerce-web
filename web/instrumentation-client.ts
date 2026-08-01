import * as Sentry from '@sentry/nextjs';

/**
 * Przeglądarka. Ten plik trafia do kodu klienta, więc DSN musi być publiczny —
 * i jest, to identyfikator projektu, nie sekret.
 *
 * Bez DSN nie wołamy `init` w ogóle: SDK i tak nie miałby dokąd wysyłać,
 * a łata na fetch, historię i konsolę zostaje założona tak czy owak.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? 'development',

    tracesSampleRate: 0.1,

    /**
     * Powtórek sesji tu nie ma i to decyzja o wadze bundla, nie o
     * przydatności. Sam `replayIntegration` dokłada ~40 kB do każdego wejścia
     * na sklep — przy 102 kB, jakie strona ważyła przed Sentry, to za dużo
     * za wygodę przy debugowaniu.
     *
     * Jeśli kiedyś zabraknie kontekstu przy błędach koszyka, wraca tak:
     *
     *   replaysSessionSampleRate: 0,
     *   replaysOnErrorSampleRate: 1,
     *   integrations: [Sentry.replayIntegration({
     *     maskAllText: true, maskAllInputs: true, blockAllMedia: true,
     *   })],
     *
     * Maskowanie jest obowiązkowe: w formularzu zamówienia klient wpisuje
     * adres i telefon.
     */

    sendDefaultPii: false,

    // Rozszerzenia przeglądarki i skrypty zewnętrzne potrafią zasypać projekt
    // szumem, który nie ma nic wspólnego ze sklepem.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],

    debug: false,
  });
}

/** Nawigacja App Routera — bez tego przejścia między stronami nie mają śladu. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
