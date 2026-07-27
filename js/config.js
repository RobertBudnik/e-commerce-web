/**
 * Adresy i klucze backendu.
 *
 * Puste wartości = tryb offline: strona działa na danych z js/data.js
 * i localStorage, dokładnie jak dotąd. Wpisanie URL-a i klucza przełącza
 * cały front na Supabase — bez zmian w pozostałych plikach.
 *
 * Lokalnie wypisuje je `npm run db:start`:
 *   API URL  → SUPABASE_URL
 *   anon key → SUPABASE_ANON_KEY
 *
 * Chmura: Project Settings → API.
 *
 * Oba klucze są publiczne i z założenia trafiają do przeglądarki — dostępu
 * pilnuje RLS w bazie, nie ich tajność. Klucz service_role nie ma tu wstępu.
 */
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** Czy front ma rozmawiać z bazą, czy zostaje na atrapach. */
const BACKEND_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
