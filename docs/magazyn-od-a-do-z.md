# Magazyn — opis od A do Z

Stan na 15.08.2026, odczytany z kodu. Dokument opisuje, **co magazyn robi**,
żeby dało się na tej podstawie zaprojektować, **jak ma wyglądać**.

---

## 1. Czym jest magazyn

Narzędzie pracy, nie część sklepu. Obsługuje go magazynier albo właściciel,
zwykle **na telefonie, jedną ręką, często w rękawicy**, stojąc przy regale
albo przy stole pakowym. Nie jest to ekran do studiowania — to ekran do
rzucenia okiem i dotknięcia.

Cała sekcja jest za logowaniem (`wymagajZaplecza`), oznaczona
`robots: noindex`, i nie ma nic wspólnego z tym, co widzi klient.

### Dwie twarze

Ten sam kod renderuje się dwojako, a rozróżnia je **wyłącznie powłoka**
(User-Agent aplikacji albo tryb standalone), nie adres:

| | przeglądarka | powłoka (aplikacja na telefonie) |
|---|---|---|
| rola | podstrona sklepu | samodzielny przyrząd |
| nagłówek i stopka sklepu | są | nie ma |
| krój | Geist, jak reszta serwisu | systemowy (`-apple-system`) |
| tło | tło sklepu | `--panel`, własne |
| wysokość | z treści | `100dvh` |
| kadr | kolumna 34 rem wyśrodkowana | od krawędzi do krawędzi |
| pasek zakładek | brak (jest nawigacja sklepu) | natywny, rysowany przez system |

**To rozróżnienie jest projektowe, nie techniczne.** Na laptopie magazyn ma
być miejscem w serwisie, z drogą powrotną do sklepu. Na telefonie ma być
aplikacją, która nie udaje strony.

---

## 2. Siedem ekranów

### 2.1 Przegląd — `/magazyn`

Ekran startowy. Odpowiada na jedno pytanie: **co dziś wymaga mojej uwagi**.

**Zawiera:**
- nagłówek: „Przegląd" + dzisiejsza data słownie
- karta z trzema wierszami-skrótami, każdy z diodą, nazwą, liczbą i szewronem:
  - Do wysłania → `/magazyn/zamowienia?stan=nowe` (dioda akcentem)
  - Niskie stany → `/magazyn/stany?segment=niskie` (dioda ostrzegawcza)
  - Zwroty do przyjęcia → `/magazyn/zwroty` (dioda neutralna)
- sekcja „Dzisiaj" — dwa kafle z liczbą i podpisem: wysłanych paczek,
  przyjętych sztuk
- sekcja „Ostatnie ruchy" — lista ostatnich zmian stanu: nazwa produktu,
  powód, godzina, po prawej delta ze znakiem (`+12 szt.` / `−3 szt.`)
- na końcu: przełącznik motywu aplikacji (ustawienie urządzenia, nie treść
  pracy — dlatego pod wszystkim)

**Stan pusty:** „Brak ruchów dzisiaj".

### 2.2 Stany — `/magazyn/stany`

Lista wszystkiego, co jest na stanie.

**Zawiera:**
- nagłówek „Magazyn" + liczba pozycji
- pole szukania (odbicie na wpisywaniu)
- pasek trzech segmentów: **Wszystko · Niskie · Zero**, przy „Niskie" licznik
- lista pozycji: dioda stanu, nazwa, meta (SKU lub kod kreskowy · kategoria ·
  ewentualnie „próg N"), po prawej liczba sztuk, szewron

**Trzy poziomy diody i liczby:** zwykły, ostrzegawczy (na progu lub poniżej),
brak (zero sztuk).

**Stany puste, każdy inny:** „Brak pozycji poniżej progu" · „Wszystko ma
pokrycie w magazynie" · „Nic nie pasuje do «fraza»" · „Magazyn jest pusty".

### 2.3 Korekta stanu — `/magazyn/stany/[id]`

Najważniejszy ekran roboczy. Tu magazynier zmienia liczbę sztuk.

**Zasada:** liczba na ekranie to **wynik**, nie wartość do wpisania.
Magazynier liczy sztuki w kartonie i dokłada je do tego, co już jest.
Wpisywanie sumy kończy się nadpisaniem cudzej korekty sprzed minuty.

**Zawiera:**
- nagłówek: nazwa produktu + podtytuł
- karta licznika:
  - górny wiersz: „Po zapisie" ← → „próg N" albo „bez progu"
  - środek: duży **−**, ogromna liczba wyniku, duży **+**
  - pod spodem: „było N · +12" (delta na kolorze)
  - ostrzeżenie, gdy wynik schodzi poniżej zera
  - cztery skoki: **+1 +5 +10 +50** (pigułki, aktywna wypełniona)
- przełącznik kierunku: „przełącz na odejmowanie" / „na dodawanie" —
  zmienia znaczenie skoków
- sekcja „Powód" — lista wyboru (radio) z gotowych powodów
- sekcja „Notatka" — nieobowiązkowe pole tekstowe
- przycisk zapisu, aktywny dopiero gdy: delta ≠ 0, powód wybrany,
  wynik ≥ 0

**Klucz idempotencji** powstaje przy otwarciu ekranu — drugie dotknięcie
„Zapisz" nie doda drugiego ruchu.

### 2.4 Zamówienia — `/magazyn/zamowienia`

Kolejka pracy pakowacza.

**Zawiera:** nagłówek, pasek segmentów po stanie zamówienia
(**nowe · spakowane · wysłane**) z licznikami, lista zamówień: numer, godzina,
liczba pozycji, szewron.

### 2.5 Zamówienie — `/magazyn/zamowienia/[numer]`

**Zawiera:** powrót, numer zamówienia, pigułka stanu, blok płatności (kwota +
opis), dane odbiorcy, lista pozycji do spakowania, akcje na dole (spakowane →
wysłane, nadanie przesyłki).

### 2.6 Skan — `/magazyn/skan`

Ekran kamery. Skanowanie kodu kreskowego prowadzi wprost do produktu.

**Zawiera:** kadr kamery (czarny, niezależnie od motywu), białą ramkę
celownika z klamrami w rogach, podpowiedź, arkusz wysuwany od dołu
z odczytanym produktem (kod, nazwa, stan, akcje).

**Ma własny przełącznik motywu: Auto · Jasny · Ciemny.** Obraz z kamery czyta
się inaczej niż lista, więc ten jeden ekran wolno wyłamać z motywu całości.
Wybór przeżywa przeładowanie.

### 2.7 Zwroty — `/magazyn/zwroty`

Lista zgłoszeń do przyjęcia: dioda neutralna, nazwa, meta, liczba, szewron.
Przyjęcie zwrotu podnosi stan.

---

## 3. Język wizualny — stan obecny

Wszystko jedzie na tokenach współdzielonych ze sklepem (paleta KokonutUI):
neutralna szarość bez barwy, powierzchnie robione przezroczystością na
atramencie, promienie `--radius-sm` 6 · `--r` 8 · `--r-lg` 16 · pigułka.

**Kolumna:** `--mag-maxw: 34rem`, rynna `--mag-gutter: clamp(12px, 4vw, 24px)`.

**Cele dotykowe:** minimum 44 px. To nie jest zalecenie — ekran obsługuje się
w rękawicy.

**Liczby** idą krojem monospace z `tabular-nums`, żeby nie skakały przy
zmianie wartości.

**Kolory znaczące** zostają mimo neutralnej palety: zielony (dostępne,
opłacone), bursztyn (oczekuje, próg), czerwony (brak).

**Ruch** (z motion.dev, w widełkach systemu ruchu):
- `whileTap` 0,92 przez 140 ms na plus/minus — jedyny sygnał „dotknięcie
  weszło", który nie wymaga czytania liczby
- animowana wysokość pod ostrzeżeniami, żeby nie zbijały przycisków w chwili,
  gdy ktoś w nie celuje
- wspólny `layoutId` na segmentach i skokach — plama przejeżdża, nie gaśnie
- arkusz od dołu: 320 ms, krzywa wykładnicza
- wszystko milknie przy `prefers-reduced-motion`

---

## 4. Prompt do wygenerowania wyglądu

Skopiuj poniższe do narzędzia projektowego.

```
Zaprojektuj sekcję magazynową aplikacji e-commerce — narzędzie pracy, nie
witrynę sklepu.

KONTEKST UŻYCIA
Użytkownik: magazynier lub właściciel. Telefon trzymany w jednej ręce, często
w rękawicy, przy regale lub stole pakowym. Światło sztuczne, hala. Ekran służy
do rzucenia okiem i dotknięcia, nie do czytania. Ta sama sekcja działa też na
laptopie, w przeglądarce.

DWIE ODMIANY, jedna makieta każda:
A) W PRZEGLĄDARCE — podstrona serwisu: pod nagłówkiem sklepu, na jego tle,
   krojem serwisu, kolumna maks. 34 rem wyśrodkowana.
B) W APLIKACJI — samodzielny przyrząd: pełna wysokość ekranu, własne tło
   o stopień głębsze, krój systemowy, kadr od krawędzi do krawędzi, u dołu
   natywny pasek zakładek.

JĘZYK WIZUALNY
Neutralna szarość, zero barwy dekoracyjnej. Tło #f5f5f5, karty #fafafa,
tekst #0a0a0a, drugi plan #6b6b6b, obrys jako przezroczystość atramentu 12%.
Ciemny wariant: tło #121212, karty #1e1e1e, tekst #ebebeb.
Promienie: 6 / 8 / 16 px oraz pigułka. Żadnych cieni poza uniesieniem.
Krój bezszeryfowy (Geist). Liczby monospace, cyfry o stałej szerokości.
Kolory wyłącznie znaczące: zielony = dostępne/opłacone, bursztyn =
oczekuje/próg, czerwony = brak. Nic nie jest kolorowe „dla ozdoby".

SIEDEM EKRANÓW
1. PRZEGLĄD — data, karta z trzema skrótami (Do wysłania / Niskie stany /
   Zwroty) z diodą, liczbą i szewronem; dwa kafle „Dzisiaj" (paczki, sztuki);
   lista ostatnich ruchów z deltą ze znakiem.
2. STANY — szukajka, pasek trzech segmentów (Wszystko / Niskie / Zero)
   z licznikiem przy „Niskie", lista pozycji: dioda, nazwa, SKU i kategoria,
   liczba sztuk, szewron. Trzy poziomy: zwykły, przy progu, zero.
3. KOREKTA STANU — najważniejszy. Duży minus, ogromna liczba wyniku, duży
   plus. Pod spodem „było N · +12". Cztery skoki +1 +5 +10 +50 jako pigułki,
   aktywna wypełniona. Przełącznik kierunku. Lista powodów. Pole notatki.
   Przycisk zapisu nieaktywny do czasu wybrania powodu.
4. ZAMÓWIENIA — segmenty po stanie (nowe / spakowane / wysłane) z licznikami,
   lista: numer, godzina, liczba pozycji.
5. ZAMÓWIENIE — numer, pigułka stanu, blok płatności, dane odbiorcy, lista
   pozycji do spakowania, akcje na dole.
6. SKAN — pełnoekranowy kadr kamery (zawsze czarny), biała ramka celownika
   z klamrami w rogach, podpowiedź, arkusz wysuwany od dołu z odczytanym
   produktem. Własny przełącznik motywu: Auto / Jasny / Ciemny.
7. ZWROTY — lista zgłoszeń do przyjęcia.

TWARDE OGRANICZENIA
· każdy cel dotykowy minimum 44 × 44 px
· liczba stanu jest największym elementem na ekranie korekty
· stan pusty każdego ekranu ma własne zdanie, nigdy „brak danych"
· kolor nigdy nie jest jedynym nośnikiem informacji — obok diody stoi podpis
· kontrast tekstu minimum 4,5:1, elementów nietekstowych 3:1
· ruch: mikrointerakcje 80–150 ms, panele 250–400 ms, nic powyżej 800 ms;
  bez bounce i elastic; wszystko milknie przy prefers-reduced-motion

CZEGO NIE ROBIĆ
Nie projektuj tego jak sklepu: żadnych zdjęć produktów w tle, gradientów,
ilustracji, okrągłych awatarów ani „kart marketingowych". To ma wyglądać jak
przyrząd pomiarowy — czytelnie, gęsto informacyjnie, bez ozdób.
```

---

## 5. Czego w tym opisie nie ma

Nie widziałem tych ekranów na oczy — cała sekcja jest za logowaniem, a opis
powstał z odczytu kodu i arkusza stylów. Proporcje, gęstość i to, jak ekrany
zachowują się przy prawdziwych danych, trzeba sprawdzić po zalogowaniu.
