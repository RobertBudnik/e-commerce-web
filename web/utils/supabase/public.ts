import { createClient } from '@supabase/supabase-js';

/**
 * Klient bez sesji — do miejsc, w których nie ma żądania, a więc i ciasteczek:
 * `generateStaticParams`, generowanie sitemapy, budowanie stron przy `next build`.
 *
 * Widzi dokładnie to, co gość: polityka `produkty: odczyt publiczny` przepuszcza
 * rolę `anon`, reszty tabel ten klucz i tak nie otworzy.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
