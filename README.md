# Nordo — szablon strony e-commerce

Statyczny szablon sklepu: czysty HTML + CSS + JavaScript, zero zależności i zero kroku budowania.
Motyw jasny, minimalizm modernistyczny — monochrom, hairline'y zamiast obwódek, cienie tylko na interakcji.

## Uruchomienie

Otwórz `index.html` w przeglądarce albo odpal lokalny serwer:

```bash
python3 -m http.server 8000
```

## Struktura

```
index.html      strona główna (hero, statystyki, kategorie, polecane, newsletter)
shop.html       lista produktów (filtry kategorii, sortowanie, szukajka)
product.html    karta produktu (?id=p-001) + podobne produkty
cart.html       koszyk (ilości, kody rabatowe, dostawa, podsumowanie)
login.html      logowanie i rejestracja (zakładki, panel beżowy z korzyściami)
account.html    panel konta — zawartość zależy od roli
admin.html      panel produktów: dodawanie, edycja, usuwanie (tylko organizacja)
css/style.css   style — tokeny w :root, motyw wyłącznie jasny
js/icons.js     cienkie ikony liniowe SVG (placeholdery zdjęć)
js/data.js      ziarno katalogu (CATEGORIES, PRODUCTS) i atrapa zamówień (ORDERS)
js/app.js       koszyk, sesja, katalog i profil w localStorage, render, role, toasty
```

Nawigacja w nagłówku to Start i Sklep — kategorie żyją wyłącznie w filtrach na `shop.html`,
żeby nie dublować tej samej listy w dwóch miejscach.

## Design

| element | decyzja |
|---|---|
| paleta | biel `#fff` jako baza, jasny beż `#f7f5f0` / `#f2ede4` jako drugi ton, grafit `#1a1815`, przygaszona terakota `#a2603f` na przecenach |
| typografia | Inter (Google Fonts) z fallbackiem systemowym; nagłówki 500 z trackingiem `-.028em`, mikroetykiety uppercase `.14em` |
| linie | 1 px `#e9e4da`, siatki rozdzielane hairline'ami zamiast ramek |
| kształt | promienie 8/14/20 px, przyciski i pola w pigułkach |
| ruch | tylko transform i kolor, 180–320 ms; pełne wyciszenie przy `prefers-reduced-motion` |

Font ładuje się z Google Fonts. Offline albo bez CDN — strona spada na systemowy grotesk;
żeby wyciąć zewnętrzny request, wrzuć plik woff2 lokalnie i podmień `<link>` na `@font-face`.

## Podmiana danych

Wszystko czyta z `js/data.js`. Zastąp `PRODUCTS` odpowiedzią z API — wymagane pola:

| pole | opis |
|---|---|
| `id` | identyfikator w URL i koszyku |
| `name`, `short` | nazwa i krótki opis |
| `category` | `id` z `CATEGORIES` |
| `price`, `oldPrice` | cena bieżąca i przekreślona (`null` = brak) |
| `rating`, `reviews` | ocena 0–5 i liczba opinii |
| `stock` | stan magazynowy; `0` blokuje przycisk zakupu |
| `icon` | klucz z `ICON_PATHS` w `js/icons.js` — placeholder zdjęcia |
| `badge` | plakietka; zaczyna się od `-` → wariant przeceny, inaczej neutralna |
| `specs` | obiekt klucz→wartość do tabeli specyfikacji |

Prawdziwe zdjęcia: podmień wywołania `icon(p.icon)` w `js/app.js` na `<img>` —
punkty to `productCard()`, `initProduct()` i render koszyka.

## Role i uprawnienia

Rola wynika z adresu e-mail podanego przy logowaniu (`ADMIN_EMAIL` w `js/app.js`):

| rola | konto | co widzi |
|---|---|---|
| organizacja | `admin@nordo.pl`, dowolne hasło | przegląd sklepu (obrót, koszty dostawy), wszystkie zamówienia z danymi klienta i adresem, klienci i adresy, lista życzeń, własne dane oraz **panel produktów** |
| klient | dowolny inny e-mail z rejestracji | wyłącznie lista życzeń i sekcja „Dane i hasło", gdzie uzupełnia imię, telefon, e-mail i adres dostawy |

Panel produktów (`admin.html`) pozwala kontu organizacji dodawać, edytować i usuwać dowolne
pozycje: nazwa, opis, kategoria, ikona, cena i cena przed obniżką, stan magazynowy, plakietka,
ocena, liczba opinii oraz specyfikacja (jedna linia = `Klucz: wartość`). Zmiany trafiają od razu
na `shop.html`, stronę produktu i do koszyka. Przycisk „Przywróć katalog startowy" kasuje
`shop.catalog.v1` i wraca do ziarna z `js/data.js`.

### To nie jest zabezpieczenie

Podział ról działa wyłącznie w przeglądarce. Ukryte sekcje da się odsłonić, wpis
`shop.user.v1` w `localStorage` da się podmienić ręcznie na `"role":"admin"`, a cudze zamówienia
i adresy w tym szablonie i tak siedzą w `js/data.js`, czyli w kodzie wysłanym każdemu.
Po stronie backendu:

- rola trzymana w sesji serwerowej, sprawdzana przy **każdym** żądaniu
- `GET /api/orders` zwraca klientowi tylko jego zamówienia — filtruje serwer, nie frontend
- `POST`/`PUT`/`DELETE /api/products` odrzucane dla konta bez roli organizacji
- `admin.html` niedostępny bez uprawnień na poziomie serwera; obecny redirect to wyłącznie UX

## Konto i logowanie — uwaga

`login.html` i `account.html` to **wyłącznie warstwa prezentacji**. Obiekt `Auth` w `js/app.js`
zapisuje w `localStorage` (`shop.user.v1`) tylko imię i e-mail, żeby dało się pokazać stan
zalogowany: awatar w nagłówku, menu konta, panel klienta. Hasło z formularza nie jest
przetwarzane — nie trafia do `localStorage` ani nigdzie indziej.

Podłączając prawdziwe logowanie:

- uwierzytelnianie i sesja po stronie serwera — ciasteczko `HttpOnly` + `Secure` + `SameSite`,
  nie token w `localStorage`
- hasła hashowane po stronie backendu (argon2id albo bcrypt), nigdy w kodzie klienta
- `account.html` chroniony na serwerze; obecne przekierowanie na `login.html` to tylko UX,
  nie zabezpieczenie
- rate limiting i CSRF na endpointach logowania i rejestracji

`ORDERS` w `js/data.js` to atrapa historii zamówień — docelowo `GET /api/orders` dla zalogowanego użytkownika.

## Konfiguracja

W `js/app.js`, u góry pliku:

- `SHIPPING_FLAT` — koszt dostawy (19,99 zł)
- `FREE_SHIPPING_FROM` — próg darmowej dostawy (300 zł)
- `COUPONS` — kody rabatowe; domyślnie `NOWY10` (10%) i `LATO20` (20%)
- `CART_KEY`, `USER_KEY`, `CATALOG_KEY`, `PROFILE_KEY` — klucze w `localStorage`
- `ADMIN_EMAIL` — adres, który dostaje rolę organizacji (atrapa)

Kolory, promienie, cienie i szerokość kolumny: zmienne CSS w `:root` w `css/style.css`.

## Czego brakuje do produkcji

- Backend: checkout, płatności, walidacja stanu magazynowego po stronie serwera
- Prawdziwe zdjęcia zamiast ikon
- Rabaty i ceny liczone na serwerze — obecna logika jest tylko po stronie klienta
- Prawdziwe uwierzytelnianie — obecny panel konta działa na atrapie sesji
