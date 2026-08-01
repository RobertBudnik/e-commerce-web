import * as Sentry from '@sentry/nextjs';

/**
 * Punkt wejścia Next.js dla instrumentacji. Konfiguracja jest w osobnych
 * plikach, bo każdy runtime dostaje swoją — import warunkowy trzyma kod Edge
 * poza bundlem node'owym i odwrotnie.
 */
export async function register() {
  // Bez DSN nie ma dokąd wysyłać, a sam `Sentry.init` po stronie Node'a
  // podpina instrumentację OpenTelemetry pod http, fetch i sterownik bazy.
  // W trybie deweloperskim kosztowało to tyle, że testy e2e przestawały
  // się wyrabiać w limitach czasu.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Błędy rzucone w renderowaniu serwerowym i w Server Actions. Bez tego
 * eksportu Next łyka je do własnego loga i nigdzie dalej nie jadą.
 */
export const onRequestError = Sentry.captureRequestError;
