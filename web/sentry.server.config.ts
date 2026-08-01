import * as Sentry from '@sentry/nextjs';

/**
 * Serwer: akcje, renderowanie i trasy API. Bez DSN `init` nic nie robi,
 * więc lokalnie i w CI Sentry po prostu milczy.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.VERCEL_ENV ?? 'development',

  // Sklep na darmowym planie nie ma budżetu na ślad z każdego żądania.
  // Błędy jadą w całości; wydajność to próbka.
  tracesSampleRate: 0.1,

  // Treść żądań potrafi nieść adresy i koszyki klientów. Nagłówki i ciasteczka
  // niosą token sesji. Nic z tego nie ma powodu opuszczać serwera.
  sendDefaultPii: false,
  maxValueLength: 2000,

  beforeSend(zdarzenie) {
    if (zdarzenie.request) {
      delete zdarzenie.request.cookies;
      delete zdarzenie.request.data;
      if (zdarzenie.request.headers) {
        delete zdarzenie.request.headers.authorization;
        delete zdarzenie.request.headers.cookie;
      }
    }
    return zdarzenie;
  },

  debug: false,
});
