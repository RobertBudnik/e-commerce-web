# Sklep e-commerce

Next.js 15 (App Router) na froncie, Supabase na zapleczu. Cała logika handlowa
siedzi w Postgresie: ceny, rabaty, dostawa, rezerwacja towaru i uprawnienia.
Przeglądarka przysyła identyfikatory produktów i ilości — resztę liczy baza.

Motyw jasny, minimalizm modernistyczny: monochrom, hairline'y zamiast obwódek,
cienie tylko na interakcji.

## Uruchomienie

Wymagany Docker (dla lokalnego Supabase) i Node 20+.

```bash
npm install && npm --prefix web install
```

```bash
npm run db:start
```

CLI wypisze adresy i klucze. Skopiuj `web/.env.example` do `web/.env.local`
i wklej `API URL` oraz `anon key`.

```bash
npm run dev
```

Sklep: <http://localhost:3000>. Studio bazy: <http://127.0.0.1:54323>.

Konta z seeda (wyłącznie lokalnie): `admin@sklep.example` i `klient@sklep.example`,
hasło `lokalne-haslo-dev`.

## Struktura

```
web/                 front na Next.js — patrz web/README.md
  e2e/               11 plików Playwrighta po lokalnym stacku (pisze do bazy)
  e2e-smoke/         testy dymne po wdrożeniu (wyłącznie odczyt)
supabase/
  migrations/        schemat, RLS, funkcje handlowe, kubełek na zdjęcia
  functions/         create-checkout i stripe-webhook
  seed.sql           dane startowe do pracy lokalnej (generowane)
scripts/
  seed-data.mjs      katalog demonstracyjny
  gen-seed.mjs       seed-data.mjs → supabase/seed.sql
  test-schema.mjs    171 testów schematu na Postgresie w WASM
.github/workflows/   CI, testy dymne po wdrożeniu, wdrażanie migracji
.devcontainer/       Codespaces z Dockerem — patrz .devcontainer/README.md
```

Dokumentacja: [web/README.md](web/README.md) (front), [BACKEND.md](BACKEND.md)
(baza i role), [DEPLOY.md](DEPLOY.md) (wdrożenie), [STRIPE.md](STRIPE.md)
(płatności).

## Co robi baza, a czego nie robi front

| reguła | gdzie |
|---|---|
| ceny i sumy | `create_order()` czyta je z `products` |
| podsumowanie koszyka | `quote_order()` — te same reguły, bez zapisu |
| rabaty | tabela `coupons`, zamknięta dla przeglądarki |
| dostawa | próg i stawka w `store_settings` |
| stany magazynowe | `take_stock()` — warunkowy UPDATE, bez oversellingu |
| płatność | `mark_order_paid()` wołane wyłącznie przez webhook operatora |
| zakres danych | polityki RLS przy każdym zapytaniu |

Rola przyjeżdża w access tokenie jako claim `user_role` (hook
`custom_access_token_hook`). Żaden adres e-mail sam z siebie nie daje uprawnień,
a ukrywanie sekcji w interfejsie to wyłącznie UX.

## Testy

```bash
npm run db:test
```

Postgres 16 skompilowany do WebAssembly, bez Dockera: uprawnienia ról, liczenie
cen, wycena koszyka, rezerwacja stanu przy równoległych zamówieniach, RLS na
zamówieniach, adresach, listach życzeń i Storage.

```bash
npm run test:e2e
```

Playwright po prawdziwym sklepie i lokalnej bazie. Testy składają zamówienia
i zdejmują stan magazynowy, więc po serii przebiegów katalog się wydrenuje —
`npm run db:reset` przywraca seed.

```bash
E2E_BASE_URL=https://adres-wdrozenia npm run test:smoke
```

Zestaw dymny — wyłącznie odczyt, bezpieczny na produkcji.

## Ciągła integracja

| workflow | kiedy | co robi |
|---|---|---|
| `.github/workflows/ci.yml` | PR i push na `main` | testy schematu, typy, audyt zależności, build produkcyjny i pełne e2e na Supabase w Dockerze |
| `.github/workflows/dym.yml` | po wdrożeniu produkcyjnym przez Vercela | testy dymne po adresie wdrożenia — tylko odczyt |
| `.github/workflows/migracje.yml` | ręcznie (`workflow_dispatch`) | `supabase db push` na produkcję za bramką potwierdzenia |

Praca w chmurze: [`.devcontainer/README.md`](.devcontainer/README.md) —
Codespaces z Dockerem, więc lokalny Supabase działa bez własnej maszyny.

## Czego brakuje do produkcji

- klucze operatora płatności — bez nich zamówienie powstaje, ale nikt go nie opłaci
- faktury i paragony — sklep ich nie wystawia, plan w [docs/platnosci-plan.md](docs/platnosci-plan.md)
- integracja z API przewoźnika — numer przesyłki wpisuje się dziś ręcznie w panelu
- dane sprzedawcy i obietnice handlowe w `web/lib/dane-sklepu.ts` — pola ze znacznikiem `⟨…⟩`
  nie są wypełnione, a sklep celowo nie wyświetla sekcji, której nie ma
