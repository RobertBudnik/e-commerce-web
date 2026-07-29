import type { CookieOptions } from '@supabase/ssr';

/**
 * Flagi ciasteczka sesji, jedno miejsce dla serwera i middleware.
 *
 * `httpOnly` — token nie jest widoczny dla JavaScriptu w karcie; działa,
 * bo wszystkie zapytania do bazy idą przez serwer.
 * `secure` — na produkcji ciasteczko jedzie wyłącznie po HTTPS. Lokalnie
 * musi zostać wyłączone, inaczej przeglądarka odrzuci je na `http://localhost`.
 * `sameSite: lax` — przetrwa powrót z bramki płatności, ale nie poleci
 * przy żądaniach z obcych stron.
 */
export function sessionCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}
