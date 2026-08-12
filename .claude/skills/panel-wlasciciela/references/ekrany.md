# Ekrany zaplecza

Rozpiska modułów panelu właściciela: po co istnieje, skąd bierze dane, co
pozwala zrobić i co pokazuje, kiedy danych nie ma. Kolejność odbija częstotliwość
użycia, nie wagę modułu — właściciel wchodzi po zamówienia codziennie,
po role raz na kwartał.

## Spis

1. [Wejście: jak panel wyłania się ze sklepu](#1-wejście-jak-panel-wyłania-się-ze-sklepu)
2. [Pulpit](#2-pulpit)
3. [Zamówienia](#3-zamówienia)
4. [Wysyłki](#4-wysyłki)
5. [Zwroty](#5-zwroty)
6. [Finanse](#6-finanse)
7. [Katalog i ceny](#7-katalog-i-ceny)
8. [Ludzie](#8-ludzie)
9. [Dziennik](#9-dziennik)
10. [Wzorce wspólne](#10-wzorce-wspólne)

---

## 1. Wejście: jak panel wyłania się ze sklepu

Wymaganie właściciela brzmi: „dla klienta ma to wyglądać jak sklep, a jak
zaloguję się jako admin, ma być panel". Realizuje się je jednym adresem i jedną
sesją, bez osobnej subdomeny i bez drugiego logowania.

- **Gość i klient** widzą sklep. Żadnego linku do panelu, żadnej wzmianki
  w stopce, `robots: { index: false }` na wszystkich ekranach zaplecza.
- **Konto organizacji** po zalogowaniu dostaje w nagłówku jeden dodatkowy
  element — wejście do panelu. Nie modal na powitanie, nie automatyczne
  przekierowanie: właściciel bywa w sklepie także po to, żeby zobaczyć go
  oczami klienta, i wyrzucanie go z witryny przy każdym logowaniu jest wadą.
- **Przekierowanie broni tylko przed pomyłką.** Wejście na `/panel` bez sesji
  odsyła na `/logowanie?powrot=…`, konto klienta na `/konto`. To jest UX.
  Dostępu pilnują RLS i `authorize()`.
- **Magazyn zostaje osobno.** `/magazyn` to aplikacja telefonu dla pakującego,
  z własnym językiem wizualnym. Panel do niej linkuje, ale jej nie wchłania —
  jedno i drugie robi się szybciej, gdy każde jest dopasowane do swojego ekranu.

Adresy: `/panel` (pulpit), `/panel/zamowienia`, `/panel/wysylki`,
`/panel/zwroty`, `/panel/finanse`, `/panel/katalog`, `/panel/ludzie`,
`/panel/dziennik`. Dzisiejszy `/panel` z formularzem produktów przenosi się pod
`/panel/katalog` — z przekierowaniem, bo właściciel ma ten adres w zakładkach.

## 2. Pulpit

**Po co:** odpowiedź na pytanie „czy dziś coś wymaga mojej uwagi", w pięć sekund,
bez klikania.

**Dane:** `sprzedaz_dziennie` (dziś i wczoraj), `getPrzeglad()` (do wysłania,
niskie stany, zwroty), ostatnie wpisy dziennika.

**Zawartość:** cztery kafle liczbowe — utarg dziś, zamówienia do wysłania,
niskie stany, zwroty do przyjęcia. Każdy kafel jest linkiem do listy z nałożonym
filtrem; liczba, w którą nie da się kliknąć, zmusza do szukania tego samego
drugi raz.

**Porównanie:** przy utargu jedna wartość odniesienia — ten sam dzień tygodnia
tydzień temu. Nie „wczoraj": poniedziałek kontra niedziela nie znaczy nic.

**Stan pusty:** świeży sklep pokazuje zera i jedno zdanie, co się tu pojawi.
Wykres z fikcyjnymi danymi „dla podglądu" jest zakazany — właściciel raz w niego
uwierzy i to wystarczy.

## 3. Zamówienia

**Po co:** codzienna obsługa. Zobaczyć, co przyszło, popchnąć dalej, odpowiedzieć
klientowi, który dzwoni z numerem.

**Dane:** `orders` + `order_items` (RLS przepuszcza zaplecze przez
`orders.read_all`).

**Lista:** numer, data, klient, kwota, stan zamówienia, stan płatności,
przewoźnik. Filtry: stan, płatność, zakres dat, szukanie po numerze, e-mailu
i numerze przesyłki. Domyślny widok to kolejka do zrobienia — `nowe` i
`spakowane` — a nie wszystko od początku świata.

**Akcje i ich granice** (baza pilnuje jednego i drugiego):

| akcja | funkcja | ograniczenie |
|---|---|---|
| nowe ⇄ spakowane | `ustaw_stan_zamowienia` | wyłącznie te dwa stany |
| nadanie przesyłki | `nadaj_przesylke` | nie na anulowanym; drugie wywołanie oddaje istniejący numer |
| anulowanie | `cancel_order` | zwraca towar na stan; zaplecze bez ograniczeń, klient tylko przed opłaceniem |
| przyjęcie zwrotu | `przyjmij_zwrot` | osobny moduł |

Stanu „dostarczone" nie stawia człowiek z ręki — przychodzi od przewoźnika.
Przycisk, który go ustawia, to zaproszenie do rozjazdu między systemem
a rzeczywistością.

**Szczegóły zamówienia:** pozycje z cenami z chwili zakupu (nie z katalogu —
`order_items` trzyma snapshot i tak ma zostać), adres, dane kontaktowe,
identyfikator płatności, oś czasu zdarzeń z dziennika. Kwoty zawsze z klasą
`.num`.

**Błędy:** komunikat z bazy pokazuj dosłownie, przy przycisku, który go wywołał.
„Zamówienie jest anulowane — towar wrócił na magazyn" mówi właścicielowi
wszystko; „Wystąpił błąd" nie mówi nic i kończy się telefonem.

## 4. Wysyłki

**Po co:** droga od spakowanej paczki do doręczenia, bez przełączania się do
panelu przewoźnika.

**Dane:** `orders.numer_przesylki` plus nowa tabela `przesylki` (przewoźnik,
punkt odbioru, status, etykieta, znacznik ostatniego odczytu) —
[model-danych.md](model-danych.md).

**Kolejka nadań:** zamówienia spakowane bez przesyłki. Jedna akcja na wiersz:
nadaj. Przy wybranym paczkomacie sposób nadania jest z góry znany, więc
formularz pyta tylko o rozmiar paczki.

**Po nadaniu:** numer, etykieta do pobrania (PDF A6), status doręczenia i data
ostatniego sprawdzenia. Etykieta idzie przez funkcję Edge, nigdy z tokenem
w przeglądarce.

**Punkt odbioru:** klient wybiera go w kasie przez Geowidget; panel go pokazuje
i pozwala poprawić, dopóki przesyłka nie jest nadana. Po nadaniu punkt jest
zamrożony — zmiana wymaga anulowania przesyłki u przewoźnika.

**Czego tu nie ma:** przycisku otwierającego skrytkę. Nie istnieje w API dla
sprzedawcy; szczegóły i co dać zamiast — [inpost-shipx.md](inpost-shipx.md).

**Stan bez integracji:** dopóki nie ma kluczy ShipX, moduł działa ręcznie —
właściciel wkleja numer z panelu przewoźnika, reszta ekranu zostaje ta sama.
Tak to działa dzisiaj i to jest poprawny stan pośredni, nie brak.

## 5. Zwroty

**Po co:** czternaście dni na odstąpienie to nie wyjątek, tylko stały strumień
pracy.

**Dane:** `zwroty`, `zwroty_pozycje`, `zglos_zwrot()`, `przyjmij_zwrot()`.

**Lista:** zgłoszone, przyjęte, odrzucone. Przy każdym: zamówienie, pozycje,
powód, data zgłoszenia i licznik dni od zgłoszenia — termin zwrotu pieniędzy
liczy się właścicielowi, nie klientowi.

**Przyjęcie** wraca towar na stan przez funkcję, nie przez korektę magazynową
z ręki. Korekta zgubi powiązanie z zamówieniem.

**Zwrot pieniędzy** jest operacją u operatora płatności i póki nie jest wpięty,
panel ma to mówić wprost: „zwróć w panelu Stripe" z numerem płatności do
skopiowania. Odhaczenie „zwrócono" bez faktycznego przelewu to najgorszy
możliwy wariant — sklep uważa, że rozliczył, klient czeka.

## 6. Finanse

**Po co:** ile zarabiam, na czym, i co wysłać księgowej.

**Dane:** `sprzedaz_dziennie`, `sprzedaz_produktow`, `zainteresowanie_produktow`,
plus `koszt_cents` w `products` dla marży. Definicja przychodu jest jedna
i pochodzi z widoków: opłacone i nieanulowane.

**Zawartość:**

- przychód w czasie, przełącznik dzień / tydzień / miesiąc,
- liczba zamówień i średnia wartość koszyka,
- marża: przychód minus koszt sprzedanych sztuk, kwotowo i procentowo,
- top produkty po przychodzie i po sztukach — to dwie różne listy i obie
  są potrzebne,
- rabaty i koszt dostawy jako osobne wiersze; obietnica darmowej wysyłki
  ma cenę i właściciel ma prawo ją widzieć,
- lejek z `shop_events`: obejrzane → w koszyku → w kasie → kupione.

**Eksport CSV:** zakres dat, jeden wiersz na zamówienie albo na pozycję (do
wyboru), `;` jako separator, UTF-8 z BOM, kwoty w złotych z przecinkiem
dziesiętnym. Bez kolumn z danymi osobowymi, jeśli raport ich nie potrzebuje.

**Podpisy pod liczbami:** każda kwota mówi, czy jest brutto. Dopóki w bazie nie
ma stawek VAT, wszystkie są brutto i tak mają być opisane.

**Stan pusty:** mniej niż siedem dni danych — pokaż liczby, ukryj wykres trendu.
Trend z trzech punktów wygląda przekonująco i nie znaczy nic.

## 7. Katalog i ceny

**Po co:** to, co dziś robi `/panel`, plus dwie rzeczy, których brakuje: koszt
zakupu i historia ceny.

**Dane:** `products`, `categories`, `product_images`, nowa `historia_cen`.

**Lista:** zdjęcie, nazwa, kategoria, cena, koszt, marża, stan, aktywność.
Filtr „poniżej progu" i „bez zdjęcia" — dwa najczęstsze powody wejścia tutaj.

**Formularz:** ten, który już jest, plus `koszt_cents` i podgląd marży liczonej
na żywo przy wpisywaniu ceny.

**Cena:** każda zmiana dopisuje wiersz do `historia_cen`. To nie jest ozdoba —
przy obniżce trzeba pokazać najniższą cenę z trzydziestu dni przed promocją
(dyrektywa Omnibus), a bez historii nie ma z czego jej policzyć. Skutki prawne
prowadzi skill `zgodnosc-sklepu`.

**Dezaktywacja zamiast kasowania.** `is_active = false` zdejmuje produkt ze
sklepu i zostawia go w zamówieniach sprzed zmiany.

**Zdjęcia:** przez istniejący kubełek i `<ProductMedia />`. Kubełek świadomie
nie pozwala listować zawartości — nie obchodź tego, wyciągając listę plików
z klienta.

## 8. Ludzie

**Po co:** właściciel zatrudnia i zwalnia, a dzisiaj rolę nadaje się wyłącznie
w bazie.

**Dane:** `user_roles`, `profiles`, `role_permissions`. Uprawnienie:
`roles.manage` — ma je tylko `owner`.

**Lista:** e-mail, imię, rola, data ostatniego logowania. Akcja: zmiana roli.

**Zabezpieczenia, które muszą być w bazie, nie w formularzu:**

- nie da się zdjąć roli ostatniemu właścicielowi — sklep bez `owner` jest nie
  do odzyskania z interfejsu,
- nikt nie nadaje roli wyższej niż własna,
- każda zmiana idzie do dziennika z tym, kto ją zrobił.

**Zapraszanie:** przez zaproszenie mailowe Supabase Auth, nie przez zakładanie
konta z hasłem w formularzu. Hasło wpisane przez kogoś innego niż właściciel
konta to hasło znane dwóm osobom.

**Podgląd uprawnień:** przy każdej roli pokaż listę uprawnień z
`role_permissions`, czytelnie. Właściciel ma wiedzieć, co daje, klikając
„manager".

## 9. Dziennik

**Po co:** rozbieżność w stanie, zniknięta zniżka, cena zmieniona w nocy —
wszystko to kończy się pytaniem „kto".

**Dane:** nowa tabela `dziennik_zaplecza`, zapisywana wyłącznie przez funkcje
`security definer`, plus `inventory_movements` jako ślad ruchów towaru.

**Lista:** czas, kto, obszar, obiekt, opis zmiany. Filtry po osobie, obszarze
i zakresie dat. Wejście z poziomu obiektu — oś czasu przy zamówieniu i przy
produkcie — jest ważniejsze niż globalna lista; ludzie pytają „co się stało
z tym zamówieniem", nie „co się działo we wtorek".

**Bez edycji i bez kasowania.** Jeśli wpis da się poprawić, dziennik przestaje
być dowodem i staje się notatnikiem.

## 10. Wzorce wspólne

**Tabele:** nagłówki kolumn klasą `.label`, liczby `tabular-nums` i do prawej,
teksty do lewej. Wiersz jest linkiem do szczegółów — cały, nie tylko numer.

**Filtry w adresie**, nie w stanie komponentu. `/panel/zamowienia?stan=nowe`
da się wysłać pracownikowi i odświeżyć bez utraty widoku. Tak działa już
`/magazyn/zamowienia?stan=nowe`.

**Stronicowanie po kursorze** przy listach, które rosną bez końca (zamówienia,
dziennik). `offset` na dziesiątym tysiącu wiersza zaczyna kosztować, a
w międzyczasie dochodzą nowe zamówienia i strony się przesuwają.

**Akcje niosące skutek poza bazą** — nadanie przesyłki, zwrot pieniędzy,
zmiana roli — pytają o potwierdzenie i mówią, co dokładnie zrobią. Pozostałe
nie pytają; potwierdzenie przy każdym kliknięciu uczy klikać „tak" bez czytania.

**Po zapisie odśwież ścieżki, które pokazują tę liczbę.** Utarg na pulpicie
i lista zamówień to dwa widoki tego samego zdarzenia; `revalidatePath` na
jednym z nich zostawia drugi z nieprawdą.

**Stan ładowania:** listy mają `loading.tsx` ze szkieletem o wysokości docelowej
zawartości. Skakanie układu w tabeli, w której czyta się kwoty, jest gorsze
niż pusty ekran przez chwilę.

**Puste i błędne stany mówią, co dalej.** „Brak zamówień w tym zakresie —
zmień daty albo wyczyść filtry" zamiast „Brak danych".
