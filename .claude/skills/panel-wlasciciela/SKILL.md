---
name: panel-wlasciciela
description: Zaplecze sklepu — jedna aplikacja, dwie twarze: sklep dla klienta i panel firmy po zalogowaniu na konto organizacji. Prowadzi budowę i rozbudowę zaplecza: zamówienia i zwroty, wysyłki z paczkomatami InPost (ShipX, Geowidget), finanse i raporty, katalog z cenami, nadawanie ról i dziennik audytu. Użyj zawsze, gdy pada „panel", „admin", „zaplecze", „system dla właściciela", „ekran dla firmy", „zamówienia w panelu", „wysyłki", „paczkomat", „InPost", „nadaj przesyłkę", „etykieta", „raport sprzedaży", „utarg", „marża", „eksport dla księgowej", „kto to zmienił", „nadaj rolę pracownikowi", a także przy każdej pracy w web/app/panel, web/app/magazyn, przy funkcjach zamówień w SQL (ustaw_stan_zamowienia, nadaj_przesylke, cancel_order, przyjmij_zwrot) i przy macierzy uprawnień role_permissions. Użyj też, gdy ktoś chce, żeby ten sam adres wyglądał dla klienta jak sklep, a po zalogowaniu jako admin pokazywał panel firmy.
---

# Panel właściciela

Jedna aplikacja, jedna baza, dwie zupełnie różne role. Klient widzi sklep i nic
poza sklepem. Konto organizacji dostaje po zalogowaniu panel: zamówienia,
wysyłki, pieniądze, ludzie. Ten skill pilnuje, żeby ta druga twarz rosła spójnie
i żeby granica między nimi szła przez bazę, a nie przez ukrywanie przycisków.

## Najpierw zobacz, co już stoi

Zaplecze nie zaczyna się od zera. Zanim cokolwiek zaprojektujesz, przeczytaj
tę mapę — połowa próśb o „panel dla firmy" jest już w połowie zbudowana i
kosztuje dopisanie ekranu, nie nową warstwę.

| co | gdzie | stan |
|---|---|---|
| role `owner` / `manager` / `staff` / `customer` | `app_role` w `20260727090000_init_schema.sql` | działa |
| uprawnienia + `authorize()` | `app_permission`, `role_permissions`, `20260801000100_role_permissions_matrix.sql` | działa |
| rola w tokenie | `custom_access_token_hook()`, `current_role_name()` | działa |
| panel produktów (desktop) | `web/app/panel/page.tsx` + `components/admin/AdminPanel` | tylko katalog |
| aplikacja magazynu (telefon) | `web/app/magazyn/**` — przegląd, zamówienia, stany, skan, zwroty | działa |
| bramka zaplecza | `web/lib/magazyn-dostep.ts` (`wymagajZaplecza`) | działa |
| granice stanów zamówień | `20260807160000_granice_stanow_zamowien.sql` | działa, sprawdzone sondą |
| zwroty | `zwroty`, `zwroty_pozycje`, `zglos_zwrot()`, `przyjmij_zwrot()` | działa |
| ślad zachowań klientów | `shop_events` | działa |
| widoki sprzedaży | `sprzedaz_dziennie`, `sprzedaz_produktow`, `zainteresowanie_produktow` | działa, bez ekranu |
| nadanie przesyłki | `nadaj_przesylke(uuid, text)` — numer wpisywany ręcznie | działa, bez przewoźnika |

Czego **nie ma** i co zwykle kryje się pod prośbą o „pełnoprawny system":
ekranu finansów i eksportu dla księgowej, kosztu zakupu (a więc i marży),
historii cen, integracji z przewoźnikiem, nadawania ról z interfejsu oraz
dziennika audytu zaplecza. Rozpiska tych braków wraz z SQL-em jest w
[references/model-danych.md](references/model-danych.md).

## Reguła nadrzędna: front chowa, baza zabrania

Klucz `anon` leży w kodzie strony i każdy może nim wołać RPC z konsoli. Ukrycie
przycisku, `redirect()` na wejściu do ekranu i `robots: { index: false }` to
wygoda i higiena, nigdy kontrola dostępu. Ta baza już raz to przerobiła —
migracja z granicami stanów powstała, bo interfejs ograniczał operacje, których
funkcje nie ograniczały, i klient mógł anulować opłaconą, dostarczoną paczkę.

Stąd kolejność pracy przy **każdym** nowym kawałku zaplecza:

1. **SQL** — tabela lub kolumna, polityka RLS, funkcja z `authorize()` w środku,
   `revoke execute … from public, anon, service_role` i `grant` dla `authenticated`.
2. **Test schematu** — `npm run db:test`, plus sonda na żywej bazie dla
   przypadków granicznych („co, jeśli zawołam to na anulowanym zamówieniu").
3. **Akcja serwerowa** w `web/app/actions/` — cienka, tylko walidacja wejścia,
   `revalidatePath` i przekazanie błędu z bazy do interfejsu.
4. **Ekran** — dopiero teraz, i pokazuje wyłącznie to, na co baza pozwala.

Odwrotna kolejność daje ekran, który obiecuje operację odrzucaną przez bazę,
albo — gorzej — operację, której baza nie odrzuca, choć powinna.

## Rola to nie uprawnienie

`rawRole` mówi, kim ktoś jest. `authorize('orders.write')` mówi, co wolno.
Sprawdzenie roli wpisane na sztywno w TypeScript (`if (user.rawRole === 'owner')`)
psuje się przy pierwszym zatrudnieniu: właściciel chce dać księgowej wgląd
w finanse bez prawa do katalogu, a jedyne, co ma, to cztery role.

Nowy obszar zaplecza = nowe uprawnienie w enumie `app_permission`, wiersze
w `role_permissions` i sprawdzenie w funkcji. Wzorzec migracji: sekcja
„Nowe uprawnienia" w [references/model-danych.md](references/model-danych.md).

Dwie pułapki tej konkretnej bazy:

- `SessionUser.role` to spłaszczenie do `'admin' | 'customer'` na potrzeby
  interfejsu. Do decyzji „czy pokazać zakładkę" używaj `rawRole`, do decyzji
  „czy wolno zapisać" — wyłącznie bazy.
- Nowe uprawnienie dopisz do **migracji**, nie do `seed.sql`. Seed nie jedzie
  na produkcję; macierz uprawnień wylądowała w migracji właśnie dlatego, że
  pusta tabela znaczyła `authorize() = false` dla każdej roli i właściciel
  odbijał się od własnego panelu bez komunikatu.

## Dwa urządzenia, dwa języki wizualne

To rozróżnienie już w kodzie jest i trzeba je utrzymać, bo wynika z tego,
kto gdzie pracuje.

| | magazyn | panel właściciela |
|---|---|---|
| kto | pakujący, w ruchu, jedna ręka | właściciel, przy biurku |
| urządzenie | telefon | desktop |
| klasy CSS | `mag-*`, duże cele dotyku, wiersze | siatka sklepu, tabele, `.panel`, `.label` |
| treść | jedna decyzja na ekran | zestawienie, filtry, porównanie |

Panel właściciela mówi językiem sklepu — te same tokeny, ta sama typografia,
`tabular-nums` na każdej kwocie. Przed zmianą wyglądu przeczytaj skill
`wyglad-i-ux`; kolorów ani `z-index`-ów nie wpisuj z palca.

Zaplecze nie potrzebuje efektów z sekcji „Zaawansowany ruch". Właściciel patrzy
na te ekrany codziennie po piętnaście razy — paralaksa w tabeli zamówień
po trzecim dniu jest wyłącznie przeszkodą.

## Ekrany

Pełna rozpiska — co pokazuje, jakie akcje, jakie stany puste, skąd dane —
jest w [references/ekrany.md](references/ekrany.md). Czytaj ją, zanim zaczniesz
rysować: kolejność modułów nie jest przypadkowa, tylko odbija to, co właściciel
robi najczęściej.

| moduł | rdzeń | uprawnienie |
|---|---|---|
| Pulpit | utarg dziś, do wysłania, niskie stany, zwroty | `orders.read_all` |
| Zamówienia | lista z filtrami, szczegóły, zmiana stanu, anulowanie, korekta | `orders.write` |
| Wysyłki | nadanie, etykieta, punkt odbioru, status doręczenia | `orders.write` |
| Zwroty | zgłoszenia, przyjęcie, zwrot pieniędzy | `orders.write` |
| Finanse | przychód, marża, top produkty, eksport CSV | `finanse.read` (nowe) |
| Katalog | produkty, zdjęcia, ceny z historią, stany | `products.write` |
| Ludzie | konta, role, zaproszenia | `roles.manage` |
| Dziennik | kto, co, kiedy zmienił | `audyt.read` (nowe) |

## Wysyłki i paczkomaty — powiedz właścicielowi prawdę o zakresie

Prośba brzmi zwykle „chcę otwierać paczkomaty z panelu". Tego API InPostu
sprzedawcy nie daje i lepiej powiedzieć to od razu, niż po tygodniu integracji.
Otwarcie skrytki idzie z aplikacji InPost Mobile albo z kodu na etykiecie —
po stronie człowieka stojącego przy automacie, nie po stronie serwera.

Co ShipX **daje** i co warto zbudować: utworzenie przesyłki do wskazanego
paczkomatu, pobranie etykiety z kodem nadania, śledzenie statusu doręczenia,
zamówienie kuriera po odbiór. Wybór punktu przez klienta robi Geowidget.

Szczegóły — końcówki, kształt żądania, statusy, sekrety, obsługa błędów —
w [references/inpost-shipx.md](references/inpost-shipx.md).

Trzy rzeczy, których nie wolno pominąć:

- **Token ShipX nigdy nie trafia do przeglądarki.** Idzie do funkcji Edge, tak
  jak klucz Stripe'a, i tylko tam. Panel woła własną funkcję, nie InPost.
- **Nadanie jest idempotentne** — `nadaj_przesylke()` już to robi: drugie
  dotknięcie przycisku oddaje istniejący numer, zamiast tworzyć drugą paczkę.
  Rozszerzając ją o przewoźnika, zachowaj to zachowanie; przy integracji
  z ShipX oznacza to jeszcze klucz `reference` po numerze zamówienia,
  żeby ponowione żądanie nie zrodziło drugiej przesyłki po stronie InPostu.
- **Status z zewnątrz przychodzi webhookiem albo odpytywaniem** i bywa spóźniony.
  Panel pokazuje wprost, kiedy ostatnio odświeżono — „doręczono" bez daty
  odczytu jest gorsze niż „brak danych".

## Finanse — jedna definicja przychodu

Widoki analityczne już ustaliły, co jest sprzedażą: zamówienia **opłacone
i nieanulowane**. Trzymaj się tego wszędzie. Druga definicja w drugim miejscu
znaczy dwie różne liczby na jednym ekranie i telefon od księgowej.

- Marża wymaga kosztu zakupu, którego w `products` nie ma — bez `koszt_cents`
  nie da się jej policzyć i nie wolno jej udawać średnią narzutu.
- Kwoty żyją w groszach jako `integer`. Do złotówek przeliczasz przy
  wyświetlaniu i przy eksporcie, nigdy w środku sumowania.
- Eksport CSV składasz na serwerze i podajesz jako pobranie. Separator `;`
  i kodowanie UTF-8 z BOM, bo plik ląduje w polskim Excelu.
- Podatek: dopóki nie ma stawek VAT przy produktach, raport mówi „przychód
  brutto" i tak ma być podpisany. Nazwanie tego „obrotem netto" to nie
  literówka, tylko błąd w księgach.

## Dane osobowe w panelu

Panel pokazuje adresy, telefony i historię zakupów — to jest przetwarzanie
danych osobowych, a nie „tabelka". Zasady, które nie kosztują nic, a zamykają
większość ryzyka:

- Ekran pokazuje tyle, ile potrzeba do zadania. Pakujący widzi adres wysyłki;
  historii zakupów klienta nie potrzebuje.
- Eksport z danymi klientów tylko tam, gdzie jest po co — raport sprzedaży
  dla księgowej nie potrzebuje kolumny z nazwiskiem.
- Skasowane konto znika, ale zamówienie zostaje: `user_id` idzie
  `on delete set null`, e-mail w zamówieniu jest osobną kolumną. Nie „naprawiaj"
  tego kaskadą — dokumenty księgowe muszą przeżyć usunięcie konta.

Przy stronach informacyjnych, zgodach i regulaminie prowadzi skill
`zgodnosc-sklepu`. Nie dubluj tych ustaleń tutaj.

## Audyt: kto to zmienił

Bez dziennika pierwsza rozbieżność w stanie magazynowym kończy się słowem
przeciw słowu. `inventory_movements` zapisuje `created_by`, ale zmiany cen,
statusów i ról nie zostawiają śladu.

Dziennik zapisuje **funkcja** `security definer`, nie klient — inaczej wpis
jest tak wiarygodny jak ten, kto go pisze. Tabela jest dopisywalna i nic więcej:
brak polityki `update` i `delete` to nie przeoczenie, tylko cała jej wartość.
Wzorzec: sekcja „Dziennik zaplecza" w
[references/model-danych.md](references/model-danych.md).

## Weryfikacja

```bash
node .claude/skills/panel-wlasciciela/scripts/audyt-panelu.mjs
```

Sprawdza po wzorcach: bramkę roli na każdym ekranie zaplecza, `authorize()`
w funkcjach zapisujących, odebranie praw `public` przy funkcjach zmieniających
dane, RLS na nowych tabelach, `security_invoker` na widokach, zapis do tabel
z pominięciem funkcji, koszt zakupu wystawiony w publicznie czytanym katalogu
oraz sekrety przewoźnika poza funkcjami Edge. Znakiem `○` oznacza to, czego
jeszcze nie ma — dziennik, przesyłki — żeby brak nie udawał porządku.

```bash
npm run typecheck && npm run db:test && npm run test:e2e
```

E2E potrafi paść na zajeżdżonej bazie zamiast na twojej zmianie — przy losowych
porażkach najpierw `npm run db:reset`.

Po migracji ruszającej uprawnienia sprawdź granty osobnym zapytaniem na bazie
docelowej. `supabase db diff` ich nie pokazuje, więc brak `execute` wychodzi
dopiero na produkcji, jako „brak dostępu" u właściciela.

## Czego nie robić

- **Ekranu bez odpowiadającej mu polityki w bazie.** Jeśli powstaje przycisk,
  najpierw powstaje reguła, która go egzekwuje po stronie serwera.
- **`service_role` w aplikacji webowej.** Omija RLS w całości. Jego miejsce to
  funkcje Edge, gdzie wstrzykuje go platforma.
- **Drugiej ścieżki zapisu obok funkcji SQL.** `update` na `orders` prosto
  z klienta omija granice stanów, dla których ta migracja powstała.
- **Kasowania danych w panelu.** Zamówienie się anuluje, produkt dezaktywuje,
  konto odbiera rolę. Twarde `delete` w narzędziu używanym codziennie prędzej
  czy później zabierze coś, czego księgowość potrzebuje.
- **Sekretu przewoźnika w `NEXT_PUBLIC_*`.** Wszystko z tym przedrostkiem jest
  publiczne — także token, którym da się nadawać przesyłki na cudzy rachunek.
- **Obiecywania w interfejsie tego, czego API nie umie** — „otwórz paczkomat"
  jako przycisk w panelu to obietnica, której nie ma jak dowieźć.
