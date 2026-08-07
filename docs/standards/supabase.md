# Supabase — lista kontrolna

Stan na sierpień 2026. Dotyczy `@supabase/ssr` w Next.js App Router.

## Sesja

- [x] `@supabase/ssr`, nie `@supabase/auth-helpers-nextjs` — te drugie są
      wycofane i nie dostają już poprawek.
- [x] Sesja w ciasteczkach `HttpOnly`, nigdy w `localStorage`. XSS nie wynosi
      wtedy tokenu.
- [x] W middleware `getUser()`, nie `getSession()`. Pierwsze weryfikuje token
      u dostawcy, drugie ufa treści ciasteczka.
- [x] PKCE — `@supabase/ssr` włącza je samo dla przepływów w przeglądarce.
- [ ] Ochrona przed wyciekłymi hasłami (HaveIBeenPwned) — **wyłączona na
      wdrożonym projekcie**, włącza się jednym przełącznikiem w panelu Auth.

Źródło: [Supabase — Server-Side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs),
[password security](https://supabase.com/docs/guides/auth/password-security).

## RLS

- [x] RLS włączone na każdej tabeli z danymi użytkownika.
- [x] Rola jedzie claimem w tokenie (`custom_access_token_hook`), a nie z
      adresu e-mail ani z tabeli czytanej w polityce.
- [x] Klucz `service_role` nigdy nie trafia do przeglądarki ani do repo.
- [ ] `auth.<funkcja>()` w politykach owinięte w `(select ...)`. Bez tego
      Postgres liczy je **dla każdego wiersza**. Advisor `auth_rls_initplan`
      wskazuje dziś 13 polityk do poprawki.

```sql
-- źle: przeliczane per wiersz
using (user_id = auth.uid())
-- dobrze: policzone raz
using (user_id = (select auth.uid()))
```

Źródło: [RLS — call functions with select](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).

## Granty funkcji — najbardziej podstępne miejsce

Postgres nadaje `EXECUTE` roli `PUBLIC` **każdej nowej funkcji**. `anon`
i `authenticated` dziedziczą po `PUBLIC`, więc:

```sql
-- nic nie daje: grant po PUBLIC zostaje
revoke execute on function public.f(...) from anon, authenticated;
-- działa
revoke execute on function public.f(...) from public, anon, authenticated;
```

- [x] Każda funkcja `SECURITY DEFINER` ma `set search_path = public`.
- [x] Funkcje bez własnego sprawdzenia uprawnień odebrane od `public`.
- [x] Funkcje z wewnętrznym `authorize()` mogą zostać dostępne — sprawdzenie
      jest w ciele, nie w grancie.
- [ ] **[auto]** Stan grantów na produkcji sprawdzany zapytaniem, nie
      `supabase db diff` — diff grantów nie widzi:

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as zalogowany,
       p.prosecdef,
       coalesce(array_to_string(p.proconfig, ','), '(brak search_path)')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by anon desc, p.proname;
```

Źródło: [database linter 0028/0029](https://supabase.com/docs/guides/database/database-linter).

## Realtime

Projekt dziś nie używa realtime — magazyn odświeża się gestem i przy wejściu
na ekran. Jeśli kiedyś wejdzie:

- Subskrypcja **tylko** na ekranie, który jej potrzebuje, i odpięta w sprzątaniu
  efektu. Zapomniany kanał to otwarte gniazdo na każdą zakładkę.
- Realtime respektuje RLS wyłącznie przy włączonym `realtime.enable_rls` na
  publikacji — inaczej rozsyła wiersze wszystkim słuchającym.
- Przy dwóch osobach pakujących te same paczki realtime na `orders` daje
  realną wartość: znika okno, w którym obie widzą „nowe".

Źródło: [Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Błędy sieci i offline

- [x] Magazyn świadomie **nie** ma trybu offline. Nieaktualny status zamówienia
      jest gorszy niż jego brak — dwie osoby pakują wtedy tę samą paczkę.
- [x] `FunctionsHttpError` chowa treść odpowiedzi w `context`; bez odczytania
      `context.json()` do klienta dociera samo „non-2xx status code".
- [ ] Zapytania z powłoki mają jawny limit czasu. `WKWebView` sam nie przerwie
      wiszącego żądania, a użytkownik widzi wtedy kręciołek bez końca.

## Advisors

Uruchamiać po każdej zmianie DDL:

```bash
supabase inspect db --linked
```

albo przez MCP: `get_advisors(type: "security" | "performance")`.
