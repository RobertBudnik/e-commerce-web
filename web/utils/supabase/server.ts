import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { sessionCookieOptions } from './cookie-options';
import { cookies } from 'next/headers';

/**
 * Klient do Server Components, Server Actions i Route Handlerów.
 *
 * Sesja siedzi w ciasteczkach `HttpOnly` ustawianych przez serwer, nie
 * w `localStorage` — to jedyna realna różnica względem statycznej wersji
 * sklepu i powód, dla którego XSS nie wyniesie już tokenu.
 *
 * Klucz anon jest publiczny; zakresu danych pilnuje RLS przy każdym zapytaniu.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, sessionCookieOptions(options));
            });
          } catch {
            // Server Component nie może pisać ciasteczek. Odświeżanie sesji
            // bierze na siebie middleware, więc ten przypadek jest nieszkodliwy.
          }
        },
      },
    }
  );
}
