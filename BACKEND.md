# Nordo — backend na Supabase

Warstwa serwerowa: Postgres ze wszystkimi regułami dostępu w bazie (RLS), logika
handlowa w funkcjach SQL, płatności w funkcjach Edge. Nic nie jest przybite do
`localhost` — przejście na domenę to zmiana zmiennych środowiskowych, nie kodu.
Pełna procedura wyjścia na produkcję: [DEPLOY.md](DEPLOY.md).

## Co już działa

```
supabase/
  config.toml                              konfiguracja projektu, adresy z env(), hook roli
  migrations/
    20260727090000_init_schema.sql         tabele, typy, triggery
    20260727090100_auth_and_commerce_...   role, uprawnienia, zamówienia, magazyn
    20260727090200_rls_policies.sql        polityki RLS i GRANT-y
    20260727090300_auth_hook_grants.sql    hook roli w tokenie
    20260728120000_quote_order.sql         wycena koszyka przed zamówieniem
    20260729090000_product_images.sql      kubełek na zdjęcia i polityki Storage
    20260729120000_limit_cart_size.sql     sufit na liczbę pozycji w koszyku
  seed.sql                                 dane startowe, konto właściciela i klienta demo
  functions/
    create-checkout/                       zamówienie + sesja płatności
    stripe-webhook/                        potwierdzenie płatności (weryfikacja podpisu)
    .env.example                           wzór sekretów funkcji (Stripe, SITE_URL)
scripts/
  seed-data.mjs                            katalog demonstracyjny
  gen-seed.mjs                             seed-data.mjs → supabase/seed.sql
  test-schema.mjs                          testy schematu na Postgresie w WASM
```

## Uruchomienie bez Dockera — testy schematu

```bash
npm run db:test
```

Odpala Postgres 16 skompilowany do WebAssembly, wgrywa migracje i seed, po czym
sprawdza 86 przypadków: uprawnienia ról, liczenie cen, wycenę koszyka, rezerwację
stanu, RLS oraz dane panelu konta.
Nie zastępuje pełnego stosu (brak Auth, PostgREST, Realtime), ale weryfikuje
wszystko, co jest w SQL.

## Uruchomienie pełnego stosu — wymaga Dockera

Docker instaluje się z prawami administratora, więc ten krok należy do Ciebie:

1. Pobierz **Docker Desktop** (albo OrbStack) na Apple Silicon i zainstaluj.
2. Uruchom aplikację, poczekaj aż wieloryb w pasku menu przestanie się animować.
3. Dalej:

```bash
npm run db:start
```

CLI wypisze adresy i klucze — `API URL`, `anon key`, `service_role key`, Studio
pod `http://127.0.0.1:54323`. `API URL` i `anon key` wpisujesz do
`web/.env.local` (wzór: `web/.env.example`). `service_role key` nie ma tam
wstępu — omija RLS i należy wyłącznie do funkcji Edge, gdzie platforma
wstrzykuje go sama.

Reset bazy razem z seedem:

```bash
npm run db:reset
```

Funkcje Edge lokalnie:

```bash
npx supabase functions serve create-checkout --env-file supabase/functions/.env
npx supabase functions serve stripe-webhook --env-file supabase/functions/.env --no-verify-jwt
```

`--no-verify-jwt` przy webhooku jest konieczne: operator płatności nie nosi tokenu
użytkownika. Autentyczność żądania potwierdza podpis HMAC, nie JWT.

Sekrety funkcji lokalnie: `supabase/functions/.env` (wzór obok, w
`supabase/functions/.env.example`), ładowany automatycznie przy `supabase start` —
osobne `serve` jest potrzebne tylko wtedy, gdy chcesz podglądać logi funkcji na
żywo. Podpięcie Stripe krok po kroku opisuje [STRIPE.md](STRIPE.md).

Nie myl tego z `supabase/.env.example`: tamten plik opisuje `SITE_URL`
i `ADDITIONAL_REDIRECT_URL`, czyli zmienne czytane przez `config.toml`
z otoczenia powłoki przy starcie stacku, a nie sekrety funkcji.

## Role i uprawnienia

| rola | uprawnienia |
|---|---|
| `owner` | wszystko, łącznie z nadawaniem ról |
| `manager` | katalog, zamówienia, klienci, magazyn |
| `staff` | odczyt katalogu, obsługa zamówień, magazyn |
| `customer` | własne zamówienia, adresy, lista życzeń |

Rola trafia do access tokenu jako claim `user_role` (hook `custom_access_token_hook`,
włączony w `config.toml`). Polityki czytają ją bez dodatkowego zapytania, a gdy claimu
brakuje — funkcja `current_role_name()` sięga do tabeli `user_roles`.

Nadanie roli pracownikowi:

```sql
insert into public.user_roles (user_id, role)
select id, 'staff' from auth.users where email = 'magazyn@nordo.pl';
```

Rola zapisana w tokenie żyje do jego wygaśnięcia. Odebranie uprawnień wymaga
unieważnienia sesji (`auth.admin.signOut(user_id)`), samo skasowanie wiersza nie wystarczy.

## Logika, która musi siedzieć na serwerze

- **Ceny** — `create_order()` czyta je z tabeli `products`. Przeglądarka przysyła
  wyłącznie `product_id` i `qty`.
- **Podsumowanie koszyka** — `quote_order()` liczy je tymi samymi regułami co
  `create_order()`, tyle że bez zapisu. Front nie ma własnej arytmetyki cen,
  więc kwota z koszyka i kwota na zamówieniu nie mają jak się rozjechać.
- **Rabaty** — kupon sprawdzany w bazie przed powstaniem zamówienia, licznik użyć rośnie tam samo.
  Tabela `coupons` jest zamknięta dla przeglądarki: `quote_order()` (security definer)
  oddaje wynik dla wpisanego kodu, nigdy listy kodów.
- **Dostawa** — próg darmowej dostawy i stawka w tabeli `store_settings`.
- **Stany magazynowe** — `take_stock()` robi warunkowy `UPDATE ... WHERE stock >= qty`.
  Dwa równoległe zamówienia na ostatnią sztukę: jedno przechodzi, drugie dostaje błąd.
  Sprawdzone testem.
- **Płatność** — `mark_order_paid()` woła wyłącznie webhook z kluczem `service_role`,
  a funkcja jest idempotentna, więc powtórka zdarzenia niczego nie psuje.
- **Status zamówienia** — zwykły `UPDATE`, przepuszczany przez politykę
  `zamówienia: obsługa` (uprawnienie `orders.write`). Klient nie dostaje błędu,
  tylko zero trafionych wierszy.
- **Anulowanie** — `cancel_order()`, bo poza statusem musi wrócić towar na magazyn.
  Funkcja sama sprawdza, czy woła ją zaplecze, czy właściciel zamówienia.
- **Zdjęcia produktów** — kubełek `product-images` w Storage: odczyt publiczny,
  zapis wyłącznie dla `products.write`. W tabeli `products.image_path` siedzi sama
  ścieżka, adres publiczny składa front — przy przejściu na domenę nic nie trzeba
  migrować. Limit 5 MB i lista dozwolonych typów MIME pilnuje sam kubełek.

## Przejście na domenę

Nic w kodzie nie zawiera adresu na sztywno. Do przełączenia wystarczy:

```bash
export SITE_URL="https://nordo.pl"
export ADDITIONAL_REDIRECT_URL="https://nordo.pl/logowanie"

npx supabase link --project-ref <ref-projektu>
npx supabase db push                 # migracje na zdalną bazę
npx supabase functions deploy create-checkout
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase secrets set --env-file supabase/functions/.env
```

Do tego w panelu Supabase: **Authentication → URL Configuration** ustawić Site URL
na domenę, a w Stripe wskazać webhook na
`https://<ref>.supabase.co/functions/v1/stripe-webhook`.

Seed z kontem `admin@nordo.pl` i hasłem wpisanym w pliku jest wyłącznie do pracy
lokalnej — `db push` go nie wysyła, ale nie wolno go uruchamiać na produkcji.

## Czego jeszcze nie ma

- Faktur, integracji z kurierem, powiadomień e-mail o statusie
- Aplikacji magazynowej (PWA) — następny etap
- Wariantów produktów (rozmiar, kolor) i wielu magazynów
