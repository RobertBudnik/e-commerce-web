# Front sklepu — Next.js (App Router)

Front sklepu: Next.js 15 z sesją w ciasteczkach. Baza, migracje, polityki RLS
i funkcje SQL są wspólne z katalogiem nadrzędnym — tutaj siedzi wyłącznie
warstwa widoku.

Wcześniej sklep istniał też jako strona statyczna z zapytaniami prosto
z przeglądarki. Ta wersja została usunięta; tabela niżej mówi, co zmiana
realnie dała i dlaczego nie ma po co do niej wracać.

## Uruchomienie

Najpierw baza (w katalogu nadrzędnym):

```bash
npm run db:start
```

Potem aplikacja:

```bash
npm --prefix web run dev
```

`http://localhost:3000`. Zmienne w `web/.env.local` (wzór: `.env.example`).

## Co zmiana realnie dała

| rzecz | statyczna wersja | Next.js |
|---|---|---|
| sesja | token w `localStorage`, w zasięgu XSS-a | ciasteczko `HttpOnly` ustawiane przez serwer; `document.cookie` jest puste |
| zapytania do bazy | prosto z przeglądarki, z tokenem | Server Components i Server Actions; karta nie potrzebuje tokenu |
| katalog | pusta siatka wypełniana JavaScriptem | HTML z produktami prosto z serwera, `revalidate = 60` |
| adresy | `product.html?id=<uuid>` | `/produkt/<slug>` plus `generateStaticParams` |
| metadane | jeden opis na wszystkie produkty | `generateMetadata` z nazwą, opisem i zdjęciem produktu |
| zdjęcia | `<img>` z ręcznym `sizes` | `next/image` — skalowanie i webp/avif |
| kroje pisma | `<link>` do Google Fonts | `next/font` z własnej domeny, bez skoku układu |

RLS pozostaje jedynym prawdziwym zabezpieczeniem: middleware odsyła gościa
z `/konto` i `/panel` do logowania, ale to wyłącznie UX.

## Układ

```
app/
  layout.tsx            nagłówek, stopka, konteksty klienta, kroje
  page.tsx              strona główna (SSR)
  global-error.tsx      awaria root layoutu — własny <html>, własne kroje
  sklep/                lista produktów: SSR + wyspa z filtrami
  produkt/[slug]/       karta produktu (SSG + revalidate)
  koszyk/               koszyk i formularz zamówienia
  zamowienie/[numer]/   potwierdzenie po złożeniu zamówienia
  konto/                panel klienta i zaplecza (zależnie od roli)
  logowanie/            formularz na Server Actions
  panel/                panel produktów (guard po roli, upload do Storage)
  robots.ts             robots.txt
  sitemap.ts            mapa strony budowana z katalogu
  actions/
    auth.ts             logowanie, rejestracja, wylogowanie
    shop.ts             wycena koszyka, miniatury, lista życzeń
    account.ts          profil, adres, statusy zamówień, anulowanie
    catalog.ts          zapis i usuwanie produktów, wgrywanie zdjęć
components/             wyspy klienckie: koszyk, szuflada, podgląd, panel konta, panel produktów
lib/                    typy, mapowanie wierszy, zapytania serwerowe, formatowanie
utils/supabase/         klient serwerowy (ciasteczka), publiczny (build) i middleware
middleware.ts           odświeżanie sesji i przekierowania stron za logowaniem
e2e/                    Playwright po lokalnym stacku — pisze do bazy
e2e-smoke/              Playwright po wdrożeniu — wyłącznie odczyt
instrumentation.ts      Sentry po stronie serwera i Edge (włącza DSN)
instrumentation-client.ts  Sentry w przeglądarce (włącza DSN)
```

## Testy E2E

```bash
npm run test:e2e
```

19 przypadków na prawdziwym sklepie i prawdziwej bazie — bez atrap. Wymagają
działającego stacku Supabase; serwer deweloperski Playwright podnosi sam albo
korzysta z już uruchomionego.

Pokryte: katalog serwerowy (treść w HTML, nie dociągana przez JS), filtry,
sortowanie, szukajka, szybki podgląd, metadane produktu, koszyk z wyceną
z bazy, kod rabatowy, blokada przy braku towaru, zamówienie gościa,
`HttpOnly` na ciasteczku sesji, przekierowania dla gościa, rozdział
uprawnień klient/zaplecze, zmiana statusu i anulowanie ze zwrotem towaru.

Ten zestaw **pisze do bazy**: składa zamówienia i zdejmuje stan magazynowy.
Po serii przebiegów katalog się drenuje i testy zaczynają padać losowo —
`npm run db:reset` w katalogu nadrzędnym przywraca seed.

## Testy dymne po wdrożeniu

```bash
E2E_BASE_URL=https://adres-wdrozenia npm run test:smoke
```

Osobny zestaw, wyłącznie do odczytu: katalog, karta produktu, przekierowanie
z `/konto`, nagłówki bezpieczeństwa i sitemapa. Nie sprawdza liczby produktów
ani nazw, bo katalog produkcyjny nie ma nic wspólnego z seedem. Bezpieczny na
prawdziwym sklepie — w przeciwieństwie do `e2e/`.

## Monitorowanie błędów

Sentry włącza się wyłącznie przy ustawionym `NEXT_PUBLIC_SENTRY_DSN`. Bez niego
nie ładuje się w przeglądarce i nie instrumentuje serwera — to celowe, bo sam
`Sentry.init` po stronie Node'a podpina OpenTelemetry pod http, fetch
i sterownik bazy, co w trybie deweloperskim potrafi rozłożyć wydajność.

Koszt w przeglądarce: ~86 kB przy pierwszym wejściu (102 → 188 kB). Powtórki
sesji są świadomie pominięte, dokładałyby kolejne 40 kB.

## Czego jeszcze nie ma

- klucze operatora płatności — ścieżka ze Stripe nieprzeklikana
- powiadomienia e-mail o zamówieniu i wysyłce
