# InPost — ShipX i Geowidget

Co da się zbudować, czego nie da się zbudować, i jak wpiąć to w tę bazę
bez wypuszczania tokenu do przeglądarki.

## Spis

1. [Zakres: co API daje sprzedawcy](#1-zakres-co-api-daje-sprzedawcy)
2. [Konta i klucze](#2-konta-i-klucze)
3. [Architektura wpięcia](#3-architektura-wpięcia)
4. [Utworzenie przesyłki](#4-utworzenie-przesyłki)
5. [Etykieta i kod nadania](#5-etykieta-i-kod-nadania)
6. [Statusy i ich odczyt](#6-statusy-i-ich-odczyt)
7. [Wybór paczkomatu — Geowidget](#7-wybór-paczkomatu--geowidget)
8. [Błędy, powtórzenia, pieniądze](#8-błędy-powtórzenia-pieniądze)
9. [Zanim napiszesz kod](#9-zanim-napiszesz-kod)

---

## 1. Zakres: co API daje sprzedawcy

| właściciel prosi o… | jak jest naprawdę |
|---|---|
| „otwieranie paczkomatów z panelu" | **nie istnieje** dla sprzedawcy; skrytkę otwiera człowiek przy automacie — aplikacją InPost Mobile albo kodem z etykiety |
| nadanie paczki do paczkomatu | tak — utworzenie przesyłki z kodem punktu docelowego |
| etykieta do wydruku | tak — PDF, zwykle A6 na drukarkę etykiet |
| kod / QR do nadania w automacie | tak — jest na etykiecie, tą samą drogą |
| śledzenie doręczenia | tak — status przesyłki, plus webhook o zmianie |
| zamówienie kuriera po odbiór | tak — zlecenie odbioru (dispatch order) |
| „paczkomat otworzy się sam, gdy kurier podjedzie" | to jest aplikacja kurierska InPostu, nie API sklepu |

Powiedz to właścicielowi przy pierwszej rozmowie, jednym zdaniem, bez owijania.
Panel z przyciskiem „otwórz skrytkę", który wyświetla instrukcję zamiast otwierać,
jest gorszy niż brak przycisku.

## 2. Konta i klucze

- Konto i token generuje się w Managerze Paczek: `manager.paczkomaty.pl`
  (produkcja) i `sandbox-manager.paczkomaty.pl` (piaskownica).
- Potrzebne są **trzy** rzeczy, nie jedna: token ShipX (Bearer), identyfikator
  organizacji (wchodzi w ścieżkę URL) i osobny token Geowidgetu (ten jest
  publiczny — jedzie do przeglądarki i tylko on).
- Piaskownica ma własny host i własny token. Nie da się przełączyć środowiska
  samą zmianą hosta.

```
produkcja   https://api-shipx-pl.easypack24.net
piaskownica https://sandbox-api-shipx-pl.easypack24.net
```

Nagłówek: `Authorization: Bearer <token>`.

## 3. Architektura wpięcia

Token ShipX ma moc nadawania przesyłek na rachunek właściciela. Traktuj go jak
klucz Stripe'a — czyli tak, jak ta baza już traktuje sekrety:

```
panel (przeglądarka)
   └─ akcja serwerowa Next.js
        └─ funkcja Edge `inpost-nadanie`   ← tu i tylko tu żyje token
             ├─ POST do ShipX
             └─ zapis do `przesylki` przez RPC
```

- Sekrety: `supabase/functions/.env` lokalnie, sekrety projektu na produkcji.
  Wzorzec obok istniejących `create-checkout` i `stripe-webhook`.
- **Nigdy** `NEXT_PUBLIC_INPOST_TOKEN`. Wszystko z tym przedrostkiem wychodzi
  do przeglądarki wraz z pierwszym `<script>`.
- Postgres nie wychodzi do internetu. Baza zapisuje wynik, nie woła API —
  zawieszone żądanie trzymałoby transakcję i blokowało wiersz zamówienia.
- Statusy przychodzą webhookiem do drugiej funkcji Edge, bez JWT
  (`--no-verify-jwt`), z weryfikacją autentyczności po stronie funkcji — tak
  samo jak `stripe-webhook`.

## 4. Utworzenie przesyłki

```
POST /v1/organizations/{organization_id}/shipments
```

Kształt żądania dla paczkomatu — szkielet, nie prawda objawiona; pola sprawdź
w dokumentacji przed pisaniem kodu:

```jsonc
{
  "receiver": {
    "first_name": "Anna",
    "last_name": "Kowalska",
    "email": "anna@example.com",
    "phone": "600100200"          // wymagany: na ten numer idzie kod odbioru
  },
  "parcels": [{ "template": "small" }],   // small | medium | large
  "custom_attributes": {
    "target_point": "KRA012",             // kod paczkomatu z Geowidgetu
    "sending_method": "parcel_locker"     // nadanie w automacie
  },
  "service": "inpost_locker_standard",
  "reference": "NOR-2026-1042"            // numer zamówienia
}
```

Trzy rzeczy, które w tym repo mają znaczenie:

- `reference` to numer zamówienia i to on wiąże świat InPostu z bazą. Bez niego
  po awarii nie da się rozstrzygnąć, czy przesyłka powstała.
- Telefon odbiorcy jest przy paczkomacie obowiązkowy — kod odbioru idzie SMS-em.
  Kasa musi go zebrać, zanim ktokolwiek zacznie integrację.
- `sending_method` decyduje, jak paczka trafia do sieci: nadanie w automacie
  albo zlecenie odbioru przez kuriera. To jest wybór operacyjny właściciela,
  nie techniczny — zapytaj, jak nadaje, i ustaw domyślną wartość.

Odpowiedź niesie identyfikator przesyłki i status. Numer listu (`tracking_number`)
bywa nadawany chwilę później — po utworzeniu przesyłka przechodzi przez etap
przygotowania oferty i potwierdzenia. Kod, który zakłada gotowy numer
w odpowiedzi, będzie działał w piaskownicy i sypał się na produkcji.

## 5. Etykieta i kod nadania

```
GET /v1/shipments/{shipment_id}/label?format=pdf&type=A6
```

- Etykietę pobiera funkcja Edge i oddaje panelowi jako plik. Nie linkuj do
  końcówki InPostu z przeglądarki — link niesie token.
- Kod nadania (QR) jest **na etykiecie**. Nadający skanuje go w automacie
  i skrytka otwiera się z tej strony. To jest cała odpowiedź na „otwieranie
  paczkomatu": nie żądanie z serwera, tylko kod w ręce człowieka.
- Etykieta jest do wydruku — trzymaj proporcje A6 i nie skaluj w podglądzie.
  Rozjechany QR to paczka, której automat nie przyjmie.

## 6. Statusy i ich odczyt

Przesyłka wędruje przez łańcuch stanów — od utworzonej, przez potwierdzoną
i nadaną, po gotową do odbioru i odebraną. Dokładna lista jest w dokumentacji
i bywa dłuższa, niż się spodziewasz.

Zasady, które przeżyją każdą zmianę tej listy:

- **Nie odwzorowuj statusów InPostu jeden do jednego w bazie.** Trzymaj surowy
  status w `przesylki.status` i mapuj go w kodzie na trzy rzeczy, które panel
  naprawdę pokazuje: w drodze, do odbioru, doręczone.
- **Nieznany status nie jest błędem.** Pokaż go dosłownie i idź dalej; wyjątek
  przy nowej wartości enuma zatrzyma cały odczyt statusów.
- **Zapisuj moment odczytu** (`status_odczyt`). „Doręczono" bez daty nie mówi,
  czy to sprzed minuty, czy sprzed trzech dni.
- **Webhook plus odpytywanie zapasowe.** Webhook potrafi nie dojść. Raz na kilka
  godzin odpytaj przesyłki bez stanu końcowego — to dziesiątki żądań dziennie,
  nie tysiące.
- Stan `dostarczone` na zamówieniu stawia odczyt od przewoźnika, nie człowiek
  z panelu.

## 7. Wybór paczkomatu — Geowidget

Mapa punktów w kasie. Wersja 5 to własny element HTML z tokenem geowidgetu:

```html
<inpost-geowidget token="…" language="pl" config="parcelcollect"></inpost-geowidget>
```

- Token geowidgetu jest publiczny z założenia — to jedyny klucz InPostu, który
  wolno wpuścić do przeglądarki, i nie da się nim nadać przesyłki.
- Wybór punktu przychodzi zdarzeniem (`onpoint`); z ładunku bierzesz kod punktu
  i adres. Kod zapisz do zamówienia, adres pokaż człowiekowi — sam kod
  „KRA012" nikomu nic nie mówi przy potwierdzaniu zamówienia.
- Widget dokłada skrypt i style z zewnątrz. Trzymaj go za granicą klienta
  (`'use client'`, dynamiczny import) i nie ładuj na stronach, gdzie nie jest
  potrzebny — kasa to jedyne miejsce.
- Bez wybranego punktu nie wolno przepuścić zamówienia z dostawą do paczkomatu.
  Sprawdzenie idzie po stronie serwera, w `create_order()`, nie tylko
  w formularzu.
- Piaskownica ma osobny host widgetu i osobny token.

## 8. Błędy, powtórzenia, pieniądze

Nadanie przesyłki kosztuje i jest trudno odwracalne — to jedna z tych operacji,
przy których podwójne kliknięcie ma realną cenę.

- **Idempotencja po `reference`.** Przed utworzeniem sprawdź, czy zamówienie
  ma już przesyłkę; `nadaj_przesylke()` robi to po stronie bazy i tę własność
  trzeba zachować także przy wpięciu ShipX. Przy niepewności (timeout) najpierw
  odpytaj listę przesyłek po `reference`, dopiero potem twórz nową.
- **Timeout to nie porażka.** Żądanie mogło dojść. Zapisz próbę, pokaż
  „sprawdzam" i odpytaj — nie ponawiaj tworzenia od razu.
- **Błąd walidacji ShipX pokazuj dosłownie.** „Nieprawidłowy kod punktu"
  właściciel poprawi w dziesięć sekund; „Błąd nadania" wygeneruje telefon.
- **Limity żądań** istnieją — przy masowym nadawaniu kolejkuj, nie strzelaj
  równolegle z listy.
- **Wszystko idzie do dziennika**: kto nadał, na jakie zamówienie, jaki numer
  wyszedł. To operacja z kosztem, więc ma zostawić ślad.

## 9. Zanim napiszesz kod

Kształty żądań w tym pliku są punktem wyjścia, nie umową — InPost zmienia
dokumentację, a nazwa pola, która była poprawna rok temu, potrafi dziś zwracać
`422`. Przed implementacją:

1. Sprawdź aktualne pola i statusy w dokumentacji InPostu
   (`dokumentacja-inpost.atlassian.net`, przestrzeń „API ShipX").
2. Zrób jedno nadanie ręcznie w piaskownicy — `curl`, prawdziwy token, prawdziwy
   kod punktu. Dopiero wtedy pisz funkcję Edge.
3. Zapisz w komentarzu funkcji datę, na którą sprawdziłeś kształt żądania.
   Za pół roku to jedyna informacja, po której da się poznać, czy błąd wziął się
   ze zmiany po ich stronie.
