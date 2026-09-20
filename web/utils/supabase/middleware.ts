import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieOptions } from './cookie-options';
import { NAGLOWEK_CSP, NAGLOWEK_NONCE, losujNonce, politykaCsp } from '@/lib/csp';

/**
 * Odświeżanie sesji przy każdym żądaniu. Bez tego access token wygasa i
 * Server Components dostają użytkownika `null` mimo ważnego refresh tokenu.
 *
 * Strony za logowaniem pilnuje tu jedno przekierowanie — ale to wyłącznie UX.
 * Dane odcina RLS w bazie, niezależnie od tego, co przepuści middleware.
 */
const GUARDED = ['/konto', '/panel'];

export async function updateSession(request: NextRequest) {
  // Kopia nagłówków ŻĄDANIA: dopisujemy do niej nonce i politykę, więc
  // komponent serwerowy czyta przez headers() to, co przyszło, a nie to,
  // co wyjdzie.
  const naglowki = new Headers(request.headers);

  // Nonce losowany dla każdego żądania. Layout czyta go pod własną nazwą
  // i podpina do skryptu motywu; Next wyłuskuje go z nagłówka polityki
  // doklejonego do żądania i sam oznacza nim swoje wstawki.
  const nonce = losujNonce();
  const polityka = politykaCsp(nonce);
  naglowki.set(NAGLOWEK_NONCE, nonce);
  naglowki.set('Content-Security-Policy', polityka);

  let response = NextResponse.next({ request: { headers: naglowki } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Z `naglowki`, nie z surowego żądania: inaczej odpowiedź powstaje
          // bez nonce'a, a dzieje się to wyłącznie przy odświeżeniu sesji —
          // czyli rzadko i nie na każdym wejściu.
          response = NextResponse.next({ request: { headers: naglowki } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, sessionCookieOptions(options))
          );
        },
      },
    }
  );

  // getUser(), nie getSession(): to pierwsze weryfikuje token u dostawcy,
  // drugie ufa temu, co przyszło w ciasteczku.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && GUARDED.some((prefix) => path.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/logowanie';
    url.searchParams.set('powrot', path);
    const przekierowanie = NextResponse.redirect(url);
    przekierowanie.headers.set(NAGLOWEK_CSP, polityka);
    return przekierowanie;
  }

  response.headers.set(NAGLOWEK_CSP, polityka);
  return response;
}
