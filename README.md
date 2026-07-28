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
js/config.js    adres i klucz Supabase, przełącznik BACKEND_ENABLED
js/backend.js   jedyne miejsce, które wie o bazie — sesja, katalog, zamówienia
js/app.js       koszyk, sesja, katalog i profil, render, role, toasty
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

Rola przyjeżdża w access tokenie z Supabase. Hook `custom_access_token_hook` dokłada do niego
claim `user_role` na podstawie tabeli `public.user_roles`, `js/backend.js` mapuje ten claim na
parę `role` + `rawRole`, a `Auth.isAdmin()` w `js/app.js` sprawdza już tylko `role === 'admin'`.
Żaden adres e-mail sam z siebie nie daje uprawnień.

| rola w bazie (`rawRole`) | `role` we froncie | co widzi |
|---|---|---|
| `owner`, `manager`, `staff` | organizacja | przegląd sklepu (obrót, koszty dostawy), wszystkie zamówienia z danymi klienta i adresem, klienci i adresy, lista życzeń, własne dane oraz **panel produktów** |
| `customer` albo brak wpisu | klient | wyłącznie lista życzeń i sekcja „Dane i hasło", gdzie uzupełnia imię, telefon, e-mail i adres dostawy |

Rolę nadaje się wpisem w bazie, nie zmianą w kodzie frontu:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'twoj@adres.pl';
```

Konto właściciela do pracy lokalnej zakłada `supabase/seed.sql`: `admin@nordo.pl`, hasło
`nordo-local-dev`. Hasło żyje wyłącznie w seedzie lokalnym — na produkcji rolę nadaje się
istniejącemu użytkownikowi zapytaniem powyżej.

Panel produktów (`admin.html`) pozwala kontu organizacji dodawać, edytować i usuwać dowolne
pozycje: nazwa, opis, kategoria, ikona, cena i cena przed obniżką, stan magazynowy, plakietka,
ocena, liczba opinii oraz specyfikacja (jedna linia = `Klucz: wartość`). Zmiany trafiają od razu
na `shop.html`, stronę produktu i do koszyka. Przycisk „Przywróć katalog startowy" kasuje
`shop.catalog.v1` i wraca do ziarna z `js/data.js`.

### Co realnie pilnuje dostępu, a co jest tylko UX

Podział ról w przeglądarce to wygoda, nie zabezpieczenie: ukryte sekcje da się odsłonić,
a przekierowanie z `admin.html` na `login.html` obejdzie każdy, kto zna adres pliku.
Broni dopiero baza — polityki RLS czytają rolę z tokenu przy **każdym** zapytaniu, więc konto
bez `products.write` dostanie odmowę zapisu niezależnie od tego, co pokazuje front.

Co nadal zostaje do zrobienia:

- „Zamówienia" i „Klienci i adresy" w panelu konta lecą wciąż z `ORDERS` w `js/data.js`,
  czyli z kodu wysłanego każdemu odwiedzającemu. Dopóki nie zastąpi ich `Backend.myOrders()`,
  te dane nie są żadną tajemnicą — filtrowanie po roli w przeglądarce jest tu tylko kosmetyką
- przy wyłączonym backendzie (`BACKEND_ENABLED = false` w `js/config.js`) wraca stara atrapa:
  wpis `shop.user.v1` w `localStorage` da się ręcznie podmienić na `"role":"admin"`. To tryb
  do klikania szablonu bez bazy, nie do wystawiania na świat

## Konto i logowanie

`login.html` rozmawia z Supabase Auth naprawdę: hasło z formularza idzie prosto do
`signInWithPassword` / `signUp` i nigdzie po stronie przeglądarki nie jest zapisywane.
Sesję — access i refresh token — trzyma klient `supabase-js` i sam ją odświeża.

Jak to spięte w `js/app.js`:

- `Auth.load()` leci raz w bootstrapie, przed renderem, i odkłada użytkownika w `Auth.cached`
- dzięki temu `Auth.user()` zostaje synchroniczne — menu konta, panel i guardy renderują się
  bez czekania na sieć
- `Auth.source` mówi, skąd przyszła sesja: `baza` albo `localStorage` (ten sam wzorzec
  fallbacku co `Catalog.source`)
- gdy `BACKEND_ENABLED = false` albo backend nie odpowie, `Auth` spada na dotychczasową atrapę
  z `localStorage` — bez prawdziwego logowania, za to strona nadal działa

Rejestracja zachowuje się zależnie od `enable_confirmations` w `supabase/config.toml`.
Lokalnie flaga jest **wyłączona**, więc Supabase od razu zwraca sesję i konto ląduje w panelu.
Po jej włączeniu `signUp` sesji nie zwraca — formularz pokazuje wtedy prośbę o kliknięcie
linku z wiadomości e-mail zamiast udawać zalogowanie.

Czego to nadal nie załatwia:

- tokeny siedzą w `localStorage`, czyli są w zasięgu XSS-a. Przeniesienie ich do ciasteczka
  `HttpOnly` + `Secure` + `SameSite` wymaga własnej warstwy serwerowej przed Supabase
- `account.html` i `admin.html` chroni tylko przekierowanie w przeglądarce; dane odcina RLS,
  ale sam widok zabezpieczeniem nie jest
- limity prób logowania i rejestracji ustawia się w `[auth.rate_limit]` w `supabase/config.toml`
  — domyślne wartości warto przejrzeć przed wyjściem na produkcję

`ORDERS` w `js/data.js` to wciąż atrapa historii zamówień — podmiana na `Backend.myOrders()`
to osobny krok.

## Konfiguracja

W `js/app.js`, u góry pliku:

- `SHIPPING_FLAT` — koszt dostawy (19,99 zł)
- `FREE_SHIPPING_FROM` — próg darmowej dostawy (300 zł)
- `COUPONS` — kody rabatowe; domyślnie `NOWY10` (10%) i `LATO20` (20%)
- `CART_KEY`, `USER_KEY`, `CATALOG_KEY`, `PROFILE_KEY` — klucze w `localStorage`

Połączenie z bazą: `js/config.js` — `SUPABASE_URL`, `SUPABASE_ANON_KEY` oraz `BACKEND_ENABLED`
(ustaw na `false`, żeby kliknąć szablon na samych danych lokalnych).

Kolory, promienie, cienie i szerokość kolumny: zmienne CSS w `:root` w `css/style.css`.

## Czego brakuje do produkcji

- Backend: checkout, płatności, walidacja stanu magazynowego po stronie serwera
- Prawdziwe zdjęcia zamiast ikon
- Rabaty i ceny liczone na serwerze — obecna logika jest tylko po stronie klienta
- Historia zamówień i profil klienta w panelu konta — wciąż na atrapie z `js/data.js`
