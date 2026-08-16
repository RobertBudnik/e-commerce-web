# Handoff: Panel magazynu Nordo — makieta iOS/web

## Overview

Klikalna makieta panelu magazynowego dla sklepu Nordo: dziesięć ekranów w dwóch powłokach
(telefon 393×852 i przeglądarka 1180×780) oraz w dwóch motywach (jasny/ciemny). Pokrywa
codzienną pracę magazyniera: przegląd dnia, stany i korekty, zamówienia i ich karty, skaner
kodów EAN, zwroty oraz logowanie z resetem hasła i ekranem blokady.

Makieta powstała na bazie repozytorium `RobertBudnik/e-commerce-web` (gałąź `main`,
katalogi `web/app/magazyn`, `web/components/magazyn`, `web/app/globals.css`). Ekrany
logowania, resetu i blokady **nie istnieją jeszcze w repo** — są zaprojektowane od zera.

## About the Design Files

Pliki w tej paczce to **referencja projektowa napisana w HTML** — prototyp pokazujący
wygląd i zachowanie, a nie kod produkcyjny do skopiowania. Zadaniem jest **odtworzenie
tych ekranów w istniejącym środowisku aplikacji**: w `e-commerce-web` to Next.js App Router
z klasami `mag-*` z `web/app/globals.css`, a dla warstwy natywnej — SwiftUI
(`ios/NordoMagazyn/Sources/MagazynView.swift`). Wartości poniżej (kolory, rozmiary,
czasy animacji) są wiążące; sposób ich zapisania — nie: użyj tokenów, komponentów
i konwencji, które w kodzie już są.

Makieta trzyma cały stan w pamięci (dane demo w pliku). Docelowo zastępujesz go realnym
źródłem danych; struktury rekordów opisuje sekcja *State Management*.

## Fidelity

**High-fidelity.** Kolory, typografia, odstępy, promienie, cienie i czasy animacji są
docelowe i podane co do wartości. Odwzoruj je 1:1, korzystając z bibliotek i wzorców
obecnych w kodzie.

Zastrzeżenie: ikony w makiecie są rysowane inline jako uproszczone SVG (stroke 1.6–1.9,
viewBox 24×24). W kodzie użyj właściwego zestawu ikon aplikacji — nie przepisuj tych ścieżek.

---

## Design Tokens

Motyw przełącza atrybut `data-tokens="jasny" | "ciemny"` na kontenerze aplikacji.
Ekran skanera potrafi wymusić własny motyw niezależnie od reszty (patrz *Skaner*).

### Kolory — motyw jasny

| Token | Wartość | Zastosowanie |
|---|---|---|
| `--tlo` | `#f2f2f7` | tło ekranu |
| `--karta` | `#ffffff` | karty, wiersze list, arkusze |
| `--karta-2` | `#f2f2f7` | pasek okna przeglądarki |
| `--wypelnienie` | `rgba(118,118,128,.12)` | pola szukania, segmenty, przyciski wtórne |
| `--etykieta` | `#000000` | tekst główny |
| `--etykieta-2` | `rgba(60,60,67,.6)` | tekst pomocniczy |
| `--etykieta-3` | `rgba(60,60,67,.3)` | tekst trzeciorzędny, szewrony, nieaktywne ikony |
| `--sep` | `rgba(60,60,67,.29)` | separatory 0.5px |
| `--tint` | `#9c6644` | kolor akcji (marka) |
| `--tint-miekki` | `rgba(156,102,68,.12)` | tło plakietek stanu |
| `--zielony` | `#34c759` | stan dodatni, potwierdzenia |
| `--pomaranczowy` | `#ff9500` | próg / braki w zamówieniu |
| `--czerwony` | `#ff3b30` | zero na stanie, błędy |
| `--czerwony-miekki` | `rgba(255,59,48,.1)` | tło karty „Konto zablokowane" |
| `--pasek` | `rgba(249,249,249,.82)` | paski nawigacyjne (z blur) |
| `--pasek-linia` | `rgba(0,0,0,.16)` | górna linia paska zakładek |

### Kolory — motyw ciemny

| Token | Wartość |
|---|---|
| `--tlo` | `#000000` |
| `--karta` | `#1c1c1e` |
| `--karta-2` | `#2c2c2e` |
| `--wypelnienie` | `rgba(118,118,128,.24)` |
| `--etykieta` | `#ffffff` |
| `--etykieta-2` | `rgba(235,235,245,.6)` |
| `--etykieta-3` | `rgba(235,235,245,.3)` |
| `--sep` | `rgba(84,84,88,.65)` |
| `--tint` | `#cf9a72` |
| `--tint-miekki` | `rgba(207,154,114,.18)` |
| `--zielony` | `#30d158` |
| `--pomaranczowy` | `#ff9f0a` |
| `--czerwony` | `#ff453a` |
| `--czerwony-miekki` | `rgba(255,69,58,.18)` |
| `--pasek` | `rgba(22,22,24,.82)` |
| `--pasek-linia` | `rgba(255,255,255,.16)` |

### Typografia

Rodzina: `-apple-system, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", sans-serif`.
Wygładzanie: `-webkit-font-smoothing:antialiased`, `text-rendering:optimizeLegibility`.
Wszystkie liczby (stany, kwoty, godziny, numery zamówień): `font-variant-numeric: tabular-nums`.

| Rola | Rozmiar / waga / tracking |
|---|---|
| Tytuł ekranu | 34px / 700 / `-.028em` / line-height 1.1 |
| Tytuł karty (produkt, numer zamówienia, ekrany auth) | 28px / 700 / `-.026em` |
| Nagłówek arkusza skanera | 20px / 680 / `-.024em` |
| Wiersz listy, pole formularza | 17px / 400 / `-.02em` |
| Wartość liczbowa w wierszu | 17px / 600 / tabular |
| Przycisk główny | 17px / 600 / `-.02em` |
| Tekst pomocniczy, etykieta pola | 15px / 400 |
| Podpis, meta, nagłówek sekcji | 13px / 400 |
| Numer zamówienia w liście, plakietki | 12px / 590 / `.02em` |
| Chipy paska podglądu | 11px / 590 / `.02em` |
| Etykieta zakładki (tab bar) | 10px / 510 |
| Liczba w korekcie | 60px / 680 / `-.04em` / tabular |
| Liczba w kaflu „Dzisiaj" | 32px / 680 / `-.03em` / tabular |
| Logotyp „NORDO" | 16–19px / 700 / `.26em` / uppercase (+ `padding-left:.26em`) |

### Odstępy, promienie, cienie

- Marginesy boczne treści: **16px** (telefon i desktop).
- Karty grupowane: `border-radius: 12px`, tło `--karta`, `overflow:hidden`.
- Arkusz skanera i pasek akcji: `border-radius: 20px` / `14px`.
- Przyciski: `border-radius: 14px`, `min-height: 50px` (główne), `44px` (tekstowe).
- Pola i segmenty: `border-radius: 10px` / `9px`, wysokość 36px, wewnętrzna plama 7px.
- Kółko ±1 w korekcie: 64×64, `border-radius:50%`.
- Separator: `0.5px solid var(--sep)`, wcięty o **38px** gdy wiersz ma diodę, o **16px** gdy nie ma.
- Dioda stanu: 10×10 koło; „zero na stanie" = koło przezroczyste z obwódką 2.5px `--czerwony`.
- Cień panelu wyszukiwania: `0 12px 40px -12px rgba(0,0,0,.35), 0 0 0 .5px var(--sep)`.
- Cień toastu: `0 10px 30px -8px rgba(0,0,0,.4), 0 0 0 .5px var(--sep)`.
- Paski nawigacyjne: tło `--pasek` + `backdrop-filter: blur(24px) saturate(180%)`.

### Ruch

Presety sprężyn (motion.dev, jeden zestaw na całą aplikację):

```
snap   { type:'spring', stiffness:1218, damping:70 }   // wciśnięcie
ui     { type:'spring', stiffness:305,  damping:33 }   // powrót po puszczeniu
gentle { type:'spring', stiffness:110,  damping:20 }
```

Krzywa dla przejść CSS: `cubic-bezier(.32,.72,0,1)`.

| Zdarzenie | Animacja |
|---|---|
| Dotknięcie elementu `[data-tap]` | `scale: 0.92` (snap) → `scale: 1` (ui) na puszczenie |
| Wejście ekranu | `opacity 0→1`, `translateY 24px→0`, 420ms |
| Plama segmentu | `transform: translateX(n·100%)`, 420ms |
| Arkusz skanera | `opacity 0→1`, `translateY 50px→0`, 340ms |
| Smuga skanera | `translateY(0 → 100%-2px)`, 2.4s, `cubic-bezier(.4,0,.6,1)`, alternate |
| Wiersz panelu wyszukiwania | `opacity 0→1`, `translateY 14px→0`, 300ms, opóźnienie `index × 35ms` |
| Toast | `opacity 0→1`, `translateY -14px→0`, 300ms; znika po **2200ms** |
| Spinner logowania | `rotate 360°`, 700ms, linear |
| Przełącznik Face ID | tło i `translateX(20px)` gałki, 250ms |

`prefers-reduced-motion: reduce` wyłącza wejścia ekranów, arkusz, smugę skanera,
przejście plamy i animacje dotyku.

---

## Screens / Views

Nawigacja: cztery zakładki (Przegląd, Zamówienia, Magazyn, Skaner) + ekrany
podrzędne z paskiem powrotu. Ekrany autoryzacji chowają zakładki, nagłówek sklepu
i stopkę.

### 1. Przegląd (`przeglad`)

**Cel:** co wymaga uwagi dzisiaj.

Nagłówek: data słownie 15px/590 `--etykieta-2`, pod nią „Przegląd" 34px/700.
Dalej karta z trzema wierszami (dioda 10px + etykieta 17px + liczba 17px/600 + szewron 8×14):

- „Do wysłania" — dioda `--tint`, prowadzi do Zamówień
- „Niskie stany" — dioda `--pomaranczowy`, prowadzi do Magazynu z filtrem *Niskie*
- „Zwroty do przyjęcia" — dioda `--etykieta-3`, prowadzi do Zwrotów

Sekcja „Dzisiaj": grid 2×1, gap 12px, kafle `padding:16px`, liczba 32px/680 + podpis 13px
(`14` wysłanych paczek, `63` przyjętych sztuk).

Sekcja „Ostatnie ruchy": karta z wierszami — nazwa produktu 17px, meta 13px
(`powód · godzina`), delta 17px/600 w `--zielony` (dodatnia) lub `--czerwony` (ujemna),
zapis ze znakiem `+12` / `−3` (minus to U+2212), po nim „ szt." 13px/400 opacity .75.

Stan pusty: „Brak ruchów dzisiaj" w karcie, 15px, `--etykieta-2`, wyśrodkowane, padding 26px 16px.

### 2. Magazyn / stany (`stany`)

**Cel:** znaleźć pozycję i wejść w korektę.

Nagłówek „Magazyn" 34px + licznik pozycji 13px po prawej (odmiana: `1 pozycja` /
`2 pozycje` / `5 pozycji`).

**Wyszukiwarka z panelem poleceń** (wzorzec `action-search-bar` z Kokonut UI, MIT —
przepisany na tokeny tej aplikacji). Pole 36px, tło `--wypelnienie`, lupa 15px,
placeholder „Szukaj nazwy lub SKU", po prawej podpowiedź `⌘K` 11px/590 `--etykieta-3`
(zanika po otwarciu panelu). Fokus otwiera panel: `position:absolute; top:44px`,
karta 14px z cieniem, `z-index:30`.

- Nagłówek panelu 12px/590 `--etykieta-3`: „Szybkie akcje" (puste pole) lub „Pozycje".
- Wiersz: dioda 8px + tytuł 15px + opis 12px `--etykieta-3` + wartość po prawej 12px tabular.
- Puste pole → cztery akcje: *Skanuj kod EAN* (aparat / Akcja), *Pokaż niskie stany*
  (filtr / `N` poz.), *Do wysłania* (zamówienia / `N` szt.), *Zwroty do przyjęcia* (magazyn / Ekran).
- Wpisany tekst → max **5** pozycji pasujących do nazwy lub SKU; dioda w kolorze stanu,
  po prawej `N szt.`.
- Podświetlenie aktywnego wiersza: tło `--wypelnienie`.
- Stopka panelu 11px `--etykieta-3`: „↑↓ wybór · Enter otwiera" / „Esc zamyka".

Klawiatura: `⌘K`/`Ctrl+K` z dowolnego ekranu przechodzi na Magazyn, otwiera panel
i ustawia fokus (po 60ms). `↑`/`↓` przesuwają zaznaczenie cyklicznie, `Enter` uruchamia
zaznaczony wiersz, `Esc` zamyka. Blur zamyka panel z opóźnieniem **180ms**
(żeby zdążyło zadziałać kliknięcie w wiersz — wiersz reaguje na `mousedown`).

Segmenty *Wszystko / Niskie / Zero*: siatka 3 kolumn, tło `--wypelnienie`, plama
`--karta` z cieniem `0 3px 8px rgba(0,0,0,.12), 0 1px 1px rgba(0,0,0,.04)`.
Aktywny 13px/590 `--etykieta`, nieaktywny 13px/510 `--etykieta-2`.
Przy „Niskie" licznik 12px/600 w `--pomaranczowy`.

Lista pozycji: wiersz min 54px — dioda stanu, nazwa 17px (ellipsis), meta 13px
(`SKU · kategoria` + `· próg N` albo `· brak na stanie`), stan 17px/600 w kolorze
stanu, szewron.

Komunikaty pustej listy: „Brak pozycji poniżej progu" / „Wszystko ma pokrycie w magazynie" /
„Nic nie pasuje do „fraza”" / „Magazyn jest pusty".

### 3. Korekta stanu (`korekta`)

**Cel:** zmienić stan jednej pozycji i zapisać z powodem.

Pasek powrotu: „‹ Magazyn". Nagłówek: nazwa 28px/700, pod nią `SKU · kategoria` 13px.

Karta korekty (radius 16, padding 20/16): górny wiersz 13px — „Po zapisie" oraz po prawej
kropka 7px `--pomaranczowy` + „próg N" (albo „bez progu").
Sterowanie: grid `64px 1fr 64px` — przycisk „−" (tło `--wypelnienie`), wynik 60px/680,
przycisk „+" (tło `--tint`, ikona biała). Pod spodem 13px: „było N" + delta w `--zielony`/`--czerwony`.
Przy wyniku poniżej zera: komunikat 13px `--czerwony` „Na stanie jest N szt., nie można zdjąć M".

Skoki: grid 4 kolumn, gap 8px, min-height 44px, `+1 / +5 / +10 / +50`
(lub `−1 …` po przełączeniu kierunku). Wybrany: tło `--tint`, tekst biały.
Pod kartą link 15px `--tint`: „przełącz na odejmowanie" / „przełącz na dodawanie"
(przełączenie zeruje deltę).

Powód (radiogroup, wymagany): *Przyjęcie dostawy*, *Zwrot od klienta*, *Ubytek lub uszkodzenie*,
*Korekta inwentaryzacyjna*. Wybrany: waga 590 + ptaszek `--tint` 17×14.

Notatka: textarea 2 wiersze, radius 12, placeholder „Nieobowiązkowa — np. numer kartonu".

Stopka przyklejona do dołu (tło `--pasek`, blur, górna linia): przycisk
„Zapisz zmianę" / „Zapisz zmianę · +12 szt.", pod nim 12px `--etykieta-3`
„zmiana widoczna w sklepie od razu". Przycisk aktywny tylko gdy `delta ≠ 0`,
powód wybrany i wynik ≥ 0; nieaktywny ma `opacity:.35`.

Zapis: aktualizuje stan pozycji, zeruje deltę/powód/notatkę i pokazuje toast
„Zapisano · +12 szt.".

### 4. Zamówienia (`zamowienia`)

Nagłówek 34px. Segmenty *Nowe / Spakowane / Wysłane* z licznikiem 12px/600 w `--tint`.
Wiersz listy (min 60px): dioda (`--tint` nowe, `--etykieta-3` wysłane, `--pomaranczowy`
gdy brakuje towaru), numer 12px/590 `--etykieta-2`, klient 17px, meta 13px
(`N pozycji · sposób dostawy`, a przy brakach — „brak 1 szt. Obiektyw Lumen 35 mm w magazynie"
w `--pomaranczowy`), po prawej `N szt.` 17px/600 i godzina 13px, szewron.
Pusto: „Brak zamówień w tej zakładce".

### 5. Karta zamówienia (`zamowienie`)

Nagłówek: numer 28px/700 + plakietka stanu (tło `--tint-miekki`, tekst `--tint`, 13px/590, pill).

**Pasek akcji** (wzorzec `toolbar` z Kokonut UI): kontener `width:fit-content`,
tło `--karta`, radius 14, padding 5, gap 4. Cztery przyciski ikonowe 44px:
*Etykieta*, *Numer*, *Telefon*, *Problem*. Najechanie (`pointerenter`) rozwija podpis —
`max-width 0→120px`, `gap 0→7px`, `padding-inline 11→13px`, tło `--tint`, tekst biały,
przejście 280–300ms na krzywej `cubic-bezier(.32,.72,0,1)`. Kliknięcie pokazuje toast:
„Etykieta wysłana do drukarki", „Numer skopiowany", „Dzwonię · +48 601 300 400",
„Problem zgłoszony do obsługi".

Pozycje zamówienia: wiersze z diodą (zielona / pomarańczowa przy braku), nazwa 17px,
meta 13px (`SKU · stan N szt.` lub `stan 0 szt. · brakuje 1`), po prawej `× N` 17px/600.

Sekcja „Dostawa": lista definicji, etykieta 15px `--etykieta-2` o stałej szerokości 92px,
wartość 17px. Pola: Odbiorca, Punkt (+ adres 13px w drugiej linii), Telefon.
Sekcja „Płatność": dioda `--zielony`, „Opłacone · Przelewy24", kwota 17px/600.

Stopka przyklejona: **przycisk przytrzymania** „Przytrzymaj, aby nadać"
(patrz *Interactions*) i przycisk tekstowy „Oznacz jako spakowane".

### 6. Skaner (`skan`)

Segmenty motywu kadru *Auto / Jasny / Ciemny* — wymuszają `data-tokens` tylko dla tego ekranu.

Kadr: kwadrat 1:1, radius 20. Stan uśpiony — tło `--karta`, ikona aparatu 40px
i tekst „Tu pojawi się obraz z aparatu". Stan aktywny — tło `#000`, cztery narożniki
34×34 (biała ramka 2.5px, promień 8px na zewnętrznym rogu) w obszarze `inset:16%`
oraz smuga: linia 2px `--tint` z poświatą `0 0 18px 2px`.

Fazy: `gotowy` → przycisk „Włącz aparat”; `skanuje` → podpis „ustaw kod EAN w kadrze”,
przyciski „Odczytaj kod (podgląd)” i „Przerwij”; `znaleziony` → arkusz od dołu
(radius 20, uchwyt 36×5) z dioda `--zielony`, nazwą 20px/680, kodem `5901234123457 · AUR-X-BLK`
13px, stanem 34px/680 + „ szt.", przyciskami `−1` / `+1` (grid 2 kolumny, 54px)
oraz linkami „Otwórz kartę produktu” i „Skanuj następny”.

### 7. Zwroty (`zwroty`)

Nagłówek 34px + licznik 13px („nic nie czeka" albo „N zwrotów do przyjęcia").
Każdy zwrot to karta: wiersz nagłówkowy (numer 12px/590, klient 17px, meta 13px
`zgłoszony 12.08 · powód`), lista pozycji (`nazwa` + `× N`), a pod nią
**przycisk przytrzymania** „Przytrzymaj, aby przyjąć · N szt.".
Po przyjęciu zwrot znika z listy, leci toast „Zwrot przyjęty · N szt. na stan".
Pusto: „Brak zwrotów do przyjęcia".

### 8. Logowanie (`logowanie`)

Treść wyśrodkowana w pionie, kolumna max 400px, marginesy 16px. Zakładek i nagłówka sklepu brak.

Góra: logotyp „NORDO" 17px z kropką `--tint` 4px, tytuł „Panel magazynu" 28px/700,
podtytuł „Zaloguj się kontem pracownika" 15px `--etykieta-2`.

Baner offline (gdy brak sieci): tło `--wypelnienie`, kropka 8px `--etykieta-3`,
tekst 13px „Brak połączenia. Logowanie wymaga sieci."

Karta formularza (radius 12) z trzema wierszami rozdzielonymi separatorem 0.5px:
1. **E-mail** — etykieta 17px o szerokości 76px + input, wartość domyślna `magazyn@nordo.pl`,
   placeholder `imie@nordo.pl`, `autocomplete="username"`.
2. **Hasło** — input `password`/`text` + przycisk „Pokaż"/„Ukryj" 15px `--tint`,
   `autocomplete="current-password"`.
3. **Face ID przy następnym wejściu** — etykieta 17px + przełącznik 51×31
   (`role="switch"`), gałka 27px biała z cieniem `0 2px 5px rgba(0,0,0,.2)`,
   tło włączone `--tint`, wyłączone `--wypelnienie`, domyślnie włączony.

Błąd: akapit 13px `--czerwony` pod kartą.
Blokada: karta `--czerwony-miekki` — „Konto zablokowane" 15px/590 `--czerwony` z kropką,
niżej 13px `--etykieta-2` „Trzy nieudane próby. Spróbuj ponownie za 15 minut albo poproś
administratora o odblokowanie."

Przycisk główny: „Zaloguj się" / „Logowanie…" ze spinnerem 17px (obwódka 2px
`rgba(255,255,255,.35)`, góra biała). Nieaktywny przy blokadzie i w trakcie ładowania (`opacity:.35`).
Pod nim link 15px „Nie pamiętam hasła".

### 9. Reset hasła (`reset`)

Pasek powrotu „‹ Logowanie". Tytuł „Reset hasła" 28px, akapit 15px „Wyślemy link do
ustawienia nowego hasła na adres przypisany do konta." Karta z jednym polem E-mail,
przycisk „Wyślij link". Po wysłaniu karta potwierdzenia: kropka `--zielony`,
„Link wysłany" 17px/590, niżej 13px „Sprawdź skrzynkę {email}. Link jest ważny 30 minut."
oraz link „Wróć do logowania".

### 10. Blokada po bezczynności (`blokada`)

Treść wyśrodkowana, wyrównana do środka w poziomie. Koło 88px `--wypelnienie` z kłódką 34px,
tytuł „Panel zablokowany" 28px/700, akapit 15px „Sesja wygasła po 15 minutach bezczynności.
Rozpoczęta korekta została zapisana.", pigułka z adresem e-mail (28px, tło `--wypelnienie`, 13px).
Przycisk główny „Odblokuj przez Face ID" / „Rozpoznawanie…" (ze spinnerem),
pod nim link „Wpisz hasło" → ekran logowania.

---

## Interactions & Behavior

### Przytrzymanie zamiast kliknięcia (wzorzec `hold-button`, Kokonut UI MIT)

Dotyczy dwóch akcji nieodwracalnych: **nadania przesyłki** i **przyjęcia zwrotu**.
W magazynie chroni przed przypadkowym tapnięciem.

- Przycisk: `position:relative; overflow:hidden; touch-action:none; user-select:none`,
  tło `--tint`, radius 14, min-height 50.
- Wewnątrz warstwa postępu: `position:absolute; inset 0; width:100%;
  background:rgba(255,255,255,.28); transform:scaleX(0); transform-origin:left`.
- `pointerdown`: `setPointerCapture`, animacja `scaleX: 0→1` przez **900ms** liniowo;
  etykieta zmienia się na „Trzymaj…".
- Akcja odpala się z **`.finished` tej samej animacji**, nie z osobnego timera —
  inaczej pasek i zdarzenie rozjeżdżają się przy re-renderze.
- `pointerup` / `pointerleave` / `pointercancel`: animacja zatrzymana, `scaleX → 0`
  w 160ms, akcja unieważniona znacznikiem tożsamości (`this.znacznik`).
- Po sukcesie: „Nadane · etykieta gotowa" na zielonym tle (`--zielony`, `cursor:default`)
  i toast; zwrot znika z listy.
- Przy `prefers-reduced-motion` fallback: `setTimeout(900)` bez paska.

### Toast

Pigułka na środku u góry powłoki (`top:68px` telefon, `62px` przeglądarka), `z-index:60`,
`pointer-events:none`, tło `--karta`, kropka `--zielony` 8px, tekst 14px/590.
Wjazd 300ms, znika po 2200ms. Jednocześnie widoczny jest tylko jeden — nowy komunikat
kasuje poprzedni timer.

### Logowanie — reguły

- Hasło krótsze niż 4 znaki → błąd i inkrementacja licznika prób.
  Komunikat: „Nieprawidłowe hasło. Zostały N próby." / „…Została ostatnia próba."
  Puste pole → „Wpisz hasło do konta."
- Trzecia nieudana próba → stan `zablokowane`, przycisk wyłączony.
- Brak sieci → „Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie." (bez zużycia próby).
- Poprawne hasło → stan `ladowanie` (spinner) → po **1100ms** przejście na Przegląd,
  wyczyszczenie hasła i licznika prób.
- Face ID na ekranie blokady: ten sam bieg ładowania (1100ms) → Przegląd.
- Zmiana treści hasła kasuje komunikat błędu (nie kasuje blokady konta).

### Nawigacja i powroty

Pasek powrotu (44px, sticky, blur) na ekranach: Korekta („Magazyn"), Karta zamówienia
(„Zamówienia"), Zwroty („Przegląd"), Reset („Logowanie"). Szewron 12×20, stroke 2.4.
W powłoce przeglądarki pasek nie jest przyklejony — siedzi nad treścią w kolumnie 580px.

### Powłoki

- **Telefon**: 393×852, radius 52, obramowanie `0 0 0 11px #1c1c1e, 0 0 0 12.5px #48484a`,
  cień `0 40px 80px -30px rgba(0,0,0,.6)`. Pasek stanu 54px (9:41 + ikony), pasek czterech
  zakładek + wskaźnik home 140×5.
- **Przeglądarka**: 1180×780, radius 12, kropki okna 12px (`#ff5f57`, `#febc2e`, `#28c840`),
  pasek adresu (pill, 28px) z URL-em zależnym od ekranu (`nordo.pl/magazyn/...`),
  nagłówek sklepu 64px (Start / Sklep / Pomoc + logotyp + trzy ikony) i stopka
  („NORDO" / „© 2026"). Treść w kolumnie max 580px, padding-block 34px.
  Na ekranach autoryzacji nagłówek i stopka znikają.

---

## State Management

Stan makiety (do zastąpienia realnymi danymi i routingiem):

| Klucz | Typ | Opis |
|---|---|---|
| `ekran` | enum | `przeglad \| stany \| korekta \| zamowienia \| zamowienie \| skan \| zwroty \| logowanie \| reset \| blokada` |
| `powloka` | enum | `aplikacja \| przegladarka` (tylko makieta) |
| `motyw` | enum | `jasny \| ciemny` |
| `stany` | `Record<id, number>` | nadpisania stanów po korektach |
| `segStany` | enum | `wszystko \| niskie \| zero` |
| `fraza` | string | tekst wyszukiwania |
| `szukanie` / `aktywnyWynik` | bool / number | panel poleceń i podświetlony wiersz |
| `produktId`, `delta`, `wDol`, `powod`, `notatka` | — | formularz korekty |
| `segZam` | enum | `nowe \| spakowane \| wysłane` |
| `nadane` | bool | przesyłka nadana (karta zamówienia) |
| `przyjete` | `id[]` | przyjęte zwroty |
| `faza`, `skanMotyw` | enum | `gotowy \| skanuje \| znaleziony`; `system \| jasny \| ciemny` |
| `email`, `haslo`, `pokazHaslo`, `faceId` | — | formularz logowania |
| `stanLogowania` | enum | `zwykly \| blad \| zablokowane \| ladowanie` |
| `proby` | number | licznik nieudanych prób (blokada przy 3) |
| `bezSieci` | bool | tryb offline |
| `resetWyslany` | bool | potwierdzenie wysyłki linku |
| `trzymam` | `id \| null` | trwające przytrzymanie |
| `toast` | `string \| null` | treść komunikatu |

Dane demo w pliku: 10 produktów (`id, name, sku, kat, stock, prog`), 10 zamówień
(`numer, klient, stan, pozycji, sztuk, godzina, dostawa, brakuje?, brakujacy?`),
4 ruchy magazynowe, 2 zwroty, 4 powody korekty, skoki `[1, 5, 10, 50]`.
Źródło katalogu: `scripts/seed-data.mjs` w repo.

Odmiana liczebników (funkcja `ile`) — polski wymaga trzech form:
`1 pozycja`, `2–4 pozycje`, `5+ pozycji`, z wyjątkiem 12–14. Ta sama zasada dla zwrotów.

---

## Assets

Brak plików graficznych. Wszystkie ikony to inline SVG rysowane w makiecie
(stroke `currentColor`, grubość 1.6–2.4, viewBox 24×24 lub dopasowany).
Logotyp „NORDO" to tekst z trackingiem `.26em` i kropką `--tint`.
Fonty: systemowe (SF Pro / -apple-system) — nic do dołączenia.

W implementacji podmień ikony na zestaw używany w aplikacji.

---

## Files

| Plik | Zawartość |
|---|---|
| `Magazyn v2 Apple.dc.html` | pełna makieta — wszystkie 10 ekranów, obie powłoki, oba motywy |
| `support.js` | runtime potrzebny do otwarcia pliku w przeglądarce |
| `github.md` | mapa ekranów makiety na pliki w `RobertBudnik/e-commerce-web` |

Otwórz `Magazyn v2 Apple.dc.html` lokalnie (oba pliki w tym samym katalogu).
Pasek u góry przełącza powłokę, motyw, ekran, stan logowania, tryb offline i puste listy.

### Mapa na repozytorium

| Ekran | Pliki źródłowe |
|---|---|
| Przegląd | `web/app/magazyn/page.tsx`, `web/components/magazyn/MotywAplikacji.tsx` |
| Stany | `web/app/magazyn/stany/page.tsx`, `components/magazyn/SegmentyStanow.tsx`, `SzukajStanow.tsx` |
| Korekta | `web/app/magazyn/stany/[id]/page.tsx`, `components/magazyn/KorektaStanu.tsx`, `web/lib/magazyn-powody.ts` |
| Zamówienia | `web/app/magazyn/zamowienia/page.tsx` |
| Karta zamówienia | `web/app/magazyn/zamowienia/[numer]/page.tsx`, `components/magazyn/AkcjeZamowienia.tsx` |
| Skaner | `web/app/magazyn/skan/page.tsx`, `components/magazyn/EkranSkanera.tsx`, `Skaner.tsx`, `MotywSkanera.tsx` |
| Zwroty | `web/app/magazyn/zwroty/page.tsx`, `components/magazyn/PrzyjmijZwrot.tsx` |
| Logowanie / Reset / Blokada | **brak w repo — do zbudowania** |
| Tokeny i klasy `mag-*` | `web/app/globals.css` |
| Powłoka natywna | `ios/NordoMagazyn/Sources/MagazynView.swift` |

### Pochodzenie wzorców

Trzy wzorce interakcji pochodzą z Kokonut UI (`kokonut-labs/kokonutui`, licencja MIT):
`action-search-bar` (panel poleceń), `hold-button` (przytrzymanie) i `toolbar`
(ikona rozwijająca podpis + ulotny komunikat). Przeniesiona została **mechanika**,
nie warstwa wizualna — kolory, typografia i ruch pochodzą z tego projektu.
