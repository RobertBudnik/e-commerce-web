# Plan pracy nad magazynem

Kolejność jest wiążąca. Każdy punkt kończy się commitem i zielonym `tsc`
oraz `next build`. Punktu nie zaczynamy, dopóki poprzedni nie jest zamknięty
albo świadomie odłożony z powodem zapisanym tutaj.

Stan na 16.08.2026. Aktualizować przy każdym zamkniętym punkcie.

---

## Zasady, które obowiązują przez cały plan

1. **Nie odpalać `next build` przy chodzącym serwerze deweloperskim.**
   Build nadpisuje `.next` pod nogami dev-servera i strona zaczyna serwować
   pusty arkusz stylów. W tej sesji zdarzyło się to trzy razy. Jeśli trzeba
   zweryfikować build — najpierw zatrzymać serwer.

2. **Nie scalać przy oczekującym e2e.** `gh pr merge --auto` nie kolejkuje,
   bo repo nie ma reguły wymagającej tego checka — przechodzi od razu
   w zwykły merge.

3. **Diagnozować od `git status`.** Rozjazd drzewa roboczego z gałęzią
   sprawia, że wszystko dalej jest zgadywaniem.

4. **Sprawdzać, co widzi użytkownik, nie co zapisuje baza.** Powody ruchów
   są zapisywane wielką literą, a renderowane małą — asercja oparta na
   kolumnie była błędna.

5. **Weryfikować w symulatorze, nie na produkcji.** Build symulatora wskazuje
   `http://localhost:3000`, więc zmiany widać natychmiast. Zrzuty przez
   `xcrun simctl io <udid> screenshot`, bo panel narzędzia bywa w pętli
   restartów.

---

## 1. Rozdzielić aplikacje w Xcode

Dziś jeden projekt, jeden `NORDO_URL`. Potrzebne dwa cele:

| | bundle ID | adres | ikona |
|---|---|---|---|
| Sklep | `pl.nordo.sklep` | `/` | do zrobienia |
| Magazyn | `pl.nordo.magazyn` | `/magazyn` | obecna |

Wspólny kod powłoki, różne ustawienia. Po zbudowaniu wgrać obie na telefon
i sprawdzić, czy klient logujący się w magazynowej dostaje ekran braku
dostępu (`/magazyn/brak-dostepu`) zamiast cichego przekierowania.

**Gotowe, gdy:** obie aplikacje stoją na telefonie i mają różne ikony.

## 2. Podpiąć przycisk przytrzymania

Komponent `components/ruch/PrzyciskPrzytrzymania.tsx` jest napisany
i nieużywany. Podpiąć w dwóch miejscach i **w tym samym commicie** poprawić
test, bo `click()` przestanie działać:

- `components/magazyn/PrzyjmijZwrot.tsx` — „Przytrzymaj, aby przyjąć · N szt."
- `components/magazyn/AkcjeZamowienia.tsx` — „Przytrzymaj, aby nadać"
- `e2e/magazyn.spec.ts` — `click()` → `pointerdown` + 900 ms + `pointerup`

Komentarz w `PrzyjmijZwrot` argumentuje dziś **przeciw** potwierdzeniu.
Specyfikacja zmienia tę decyzję — komentarz trzeba przepisać, nie zostawić.

**Gotowe, gdy:** obie akcje wymagają przytrzymania, e2e zielone.

## 3. Domknąć diagnozę zwrotów

`magazyn.spec.ts:124` pada od początku sesji. Osiem hipotez wykluczonych
analizą statyczną — paleta, wielkość liter, filtr daty, `order_id`,
równoległość, brak ruchu, RLS, struktura DOM. Wszystkie się bronią.

Zostało jedno wyjaśnienie: karta „Ostatnie ruchy" wychodzi pusta, więc
`.last()` łapie kartę ze skrótami. **Dalsza analiza kodu nic nie da** —
potrzebny dowód z przebiegu:

- uruchomić ten jeden test lokalnie
- w momencie porażki zrzucić DOM przeglądu i zawartość `inventory_movements`
- artefakt `test-results/magazyn-Zwroty-…/test-failed-1.png` z CI pokaże to od razu

**Gotowe, gdy:** test zielony albo usterka opisana i naprawiona u źródła.

## 4. Trzy ekrany autoryzacji ze specyfikacji

Nie istnieją w repo. Kolejność od najprostszego:

1. **Logowanie** — logotyp, karta z trzema wierszami i separatorami 0,5 px,
   przełącznik Face ID, licznik prób, blokada po trzeciej, baner offline
2. **Reset hasła** — jedno pole, karta potwierdzenia
3. **Blokada po bezczynności** — koło 88 px z kłódką, 15 minut

Wartości w `docs/makieta-magazyn/specyfikacja.md`, sekcja *Screens*.

Przy okazji poprawić komunikat błędu logowania: dziś ma biały gruby obrys
i czyta się jak kolejne pole formularza, nie jak ostrzeżenie.

## 5. Wzorce z Kokonut UI

- **`action-search-bar`** — panel poleceń pod wyszukiwarką stanów, `⌘K`,
  strzałki, cztery szybkie akcje, maks. 5 pozycji
- **`toolbar`** — ikony rozwijające podpis na karcie zamówienia

Mechanika, nie warstwa wizualna. Licencja MIT.

## 6. Reszta warstwy wizualnej

Paski nawigacyjne z `backdrop-filter: blur(24px) saturate(180%)`, kadr
skanera ze smugą 2,4 s, toast znikający po 2200 ms, powłoki telefonu
i przeglądarki. Szczegóły w specyfikacji.

## 7. Logika: dostawy i ShipX

Największy punkt i jedyny, który wymaga decyzji przed kodem.

**Dostawy nie istnieją wcale** — ani tabeli, ani funkcji, ani ekranu. Dziś
stan rośnie wyłącznie przez ręczną korektę z powodem.

**Wysyłki działają ręcznie** — numer listu wkleja się z panelu przewoźnika.

Trzy pytania do rozstrzygnięcia z właścicielem, zanim powstanie pierwsza
migracja:

1. Skąd biorą się towary — zamówienia u dostawców i przyjęcia palet, czy
   wprowadzanie tego, co kupione samodzielnie? Od tego zależy, czy potrzeba
   dokumentu dostawy z pozycjami i rozbieżnościami.
2. Co dokładnie ma robić ShipX — tworzenie przesyłki i etykieta, śledzenie
   przez webhook, wybór paczkomatu w koszyku? Wszystkie trzy czy część?
3. Kto nadaje — magazynier z telefonu przy stole pakowym czy obsługa
   z panelu na laptopie?

Zacząć od audytu w `docs/audyt-logiki-sklepu.md` — mapa wywołań stoi, reszta
czeka na sondy SQL.

## 8. Natywna aplikacja w Swifcie

Decyzja właściciela: powłoka `WKWebView` ma ustąpić prawdziwemu klientowi
gadającemu z Supabase.

Pierwsza wersja świadomie wąska: **logowanie, skan, korekta stanu**. Trzy
rzeczy, które faktycznie robi się przy regale. Zamówienia, zwroty i dostawy
dokładać dopiero, gdy pierwsza wersja będzie w kieszeni i będzie wiadomo,
czego brakuje naprawdę.

Reguły trzymać w bazie (funkcje SQL, RLS), oba klienty traktować jako cienkie
— inaczej granice stanów rozjadą się między Next.js a Swiftem.

---

## Poza planem — do zrobienia przez właściciela

- **Ochrona wdrożeń podglądowych** w Vercelu: `Settings → Deployment
  Protection → Vercel Authentication` na `Only Production`. Bez tego podglądy
  gałęzi są za logowaniem i nie da się ich obejrzeć ani pokazać.
- **Jeden adres produkcyjny.** `nordo.vercel.app` oddaje `402`,
  `nordo-one.vercel.app` działa. CI wdraża pod projekt `nordo`. Rozstrzygnąć,
  który jest właściwy, i wyrównać `NEXT_PUBLIC_SITE_URL` oraz `NORDO_URL`.
- **Katalog demo** — `supabase/snippets/katalog-demo.sql`, jeśli sklep ma
  cokolwiek pokazywać.
- **Treści** — sklep nadal mówi `⟨nazwa sklepu⟩`. Do tego jest skill
  `wypelnij-sklep`.
