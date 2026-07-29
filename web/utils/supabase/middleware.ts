import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieOptions } from './cookie-options';

/**
 * Odświeżanie sesji przy każdym żądaniu. Bez tego access token wygasa i
 * Server Components dostają użytkownika `null` mimo ważnego refresh tokenu.
 *
 * Strony za logowaniem pilnuje tu jedno przekierowanie — ale to wyłącznie UX.
 * Dane odcina RLS w bazie, niezależnie od tego, co przepuści middleware.
 */
const GUARDED = ['/konto', '/panel'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
    return NextResponse.redirect(url);
  }

  return response;
}
