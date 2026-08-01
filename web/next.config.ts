import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

/**
 * Zdjęcia produktów leżą w Supabase Storage, więc `next/image` musi mieć
 * zgodę na ten host. Adres bierzemy ze zmiennej — lokalnie to 127.0.0.1,
 * na produkcji domena projektu.
 */
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321');

const nextConfig: NextConfig = {
  /**
   * Katalog wyjściowy z możliwością podmiany. `npm run build` używa
   * `.next-build`, żeby produkcyjny build nie deptał katalogu `.next`
   * działającego serwera deweloperskiego — inaczej dev szuka chunków,
   * których build już nie ma („Cannot find module ./vendor-chunks/…").
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  experimental: {
    // Zdjęcia produktów idą przez Server Action; domyślny limit 1 MB
    // odrzucałby wszystko powyżej miniatury. Kubełek i tak tnie na 5 MB.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port || undefined,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  /**
   * Nagłówki bezpieczeństwa. Nie zastępują RLS, ale ograniczają szkody:
   * treść sklepu nie ma powodu jechać w cudzej ramce ani wysyłać pełnego
   * adresu strony do zewnętrznych hostów.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS działa tylko po HTTPS; lokalnie przeglądarka go zignoruje
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

/**
 * Sentry wchodzi wyłącznie tam, gdzie jest DSN — czyli na wdrożeniu.
 *
 * Wtyczka buildowa dokłada swoją warstwę do webpacka i w trybie
 * deweloperskim potrafi rozciągnąć kompilację strony do dziesiątek sekund;
 * testy e2e zaczynały wtedy padać na hydratacji koszyka. Skoro bez DSN i tak
 * nie ma dokąd wysyłać zgłoszeń, opakowanie nie ma tam nic do roboty.
 *
 * Bez `SENTRY_AUTH_TOKEN` wysyłka map źródeł jest pomijana — zgłoszenia
 * dochodzą, tylko ślady stosu zostają zminifikowane.
 */
const sentryWlaczone = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryWlaczone
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Mapy źródeł idą do Sentry, ale nie zostają na serwerze — inaczej każdy
      // mógłby sobie pobrać czytelne źródła sklepu spod /_next.
      sourcemaps: { deleteSourcemapsAfterUpload: true },

      // SDK w przeglądarce kosztuje kilogramy kodu. Wycinamy z bundla to,
      // czego sklep nie używa: powtórki sesji i komunikaty diagnostyczne.
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
        excludeReplayWorker: true,
      },

      // Blokada reklam ucina requesty do sentry.io; tunel przez własną domenę
      // sprawia, że zgłoszenia dochodzą także od takich klientów.
      tunnelRoute: '/monitoring',

      // Logi wtyczki tylko wtedy, gdy build i tak jest gadatliwy.
      silent: !process.env.CI,
      disableLogger: true,

      // Cron monitor dla Vercela; przy braku zadań nic nie kosztuje.
      automaticVercelMonitors: true,
    })
  : nextConfig;
