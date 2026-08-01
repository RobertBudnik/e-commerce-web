import * as Sentry from '@sentry/nextjs';

/**
 * Runtime brzegowy — u nas middleware pilnujące sesji. Osobny plik, bo Edge
 * ma własny kontekst wykonania i nie widzi konfiguracji node'owej.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.VERCEL_ENV ?? 'development',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,

  beforeSend(zdarzenie) {
    if (zdarzenie.request) {
      delete zdarzenie.request.cookies;
      if (zdarzenie.request.headers) {
        delete zdarzenie.request.headers.authorization;
        delete zdarzenie.request.headers.cookie;
      }
    }
    return zdarzenie;
  },

  debug: false,
});
