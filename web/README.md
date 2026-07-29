# Nordo na Next.js (App Router)

Migracja statycznego sklepu z katalogu nadrzędnego na Next.js 15 z sesją
w ciasteczkach. Baza, migracje, polityki RLS i funkcje SQL zostają te same —
zmienia się wyłącznie warstwa widoku.

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

## Co migracja realnie zmienia

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
  sklep/                lista produktów: SSR + wyspa z filtrami
  produkt/[slug]/       karta produktu (SSG + revalidate)
  logowanie/            formularz na Server Actions
  actions/
    auth.ts             logowanie, rejestracja, wylogowanie
    shop.ts             wycena koszyka, miniatury, lista życzeń
    account.ts          profil, adres, statusy zamówień, anulowanie
    catalog.ts          zapis i usuwanie produktów, wgrywanie zdjęć
  panel/                panel produktów (guard po roli, upload do Storage)
components/             wyspy klienckie: koszyk, szuflada, podgląd, panel konta, panel produktów
lib/                    typy, mapowanie wierszy, zapytania serwerowe, formatowanie
utils/supabase/         klient serwerowy (ciasteczka), publiczny (build) i middleware
```

## Czego jeszcze nie ma

- ostatnio oglądane, pasek zakupu na karcie produktu, szkielety ładowania
- testy Playwrighta na ścieżkę „dodaj do koszyka → zamów → potwierdzenie"

Do tego czasu statyczna wersja w katalogu nadrzędnym działa bez zmian —
obie korzystają z tej samej bazy.
