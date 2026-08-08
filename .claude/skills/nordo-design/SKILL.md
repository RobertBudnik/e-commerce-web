---
name: nordo-design
description: Design system i reguły ruchu sklepu Nordo — tokeny, komponenty, animacje. Użyj przy każdej zmianie w web/app/globals.css, przy dodawaniu komponentów UI (modale, szuflady, paski postępu, karty) oraz gdy pojawia się prośba o animacje, mikrointerakcje albo „ładniejszy" wygląd.
---

# Nordo — design i ruch

Sklep na Next.js (App Router) w katalogu `web/`. Style w jednym pliku
`web/app/globals.css` — bez Tailwinda i bez CSS-in-JS. Dwa motywy: jasny
i ciemny, przełączane klasą `dark` na `<html>`.
Zmiany mają wyglądać, jakby były tu od początku.

## Dwa motywy — reguła nadrzędna

Wartości kolorów żyją **wyłącznie** w dwóch blokach na górze `globals.css`:
`:root` (jasny) i `.dark` (ciemny). Reszta pliku sięga po nie przez `var()`,
więc ciemny wariant nie wymaga ani jednej dodatkowej reguły w komponentach.

- Nowy kolor = **dwa wpisy**, w `:root` i w `.dark`. Jeden wpis to usterka,
  która wyjdzie dopiero po przełączeniu motywu.
- Nigdy wartość koloru wprost w regule komponentu. Odwrócony kontrast
  (jasny napis na ciemnym tle) pisze się `background: var(--ink); color: var(--bg)`
  — nie `#fff`, bo w ciemnym motywie `--ink` jest jasny i biel znika.
- Motyw wybiera skrypt blokujący w `web/app/layout.tsx` (zapis w
  `localStorage` pod `nordo-theme`, w drugiej kolejności ustawienie systemu).
  Zmiana palety wymaga też przejrzenia `viewport.themeColor` w tym samym pliku —
  pasek stanu telefonu bierze kolor stamtąd, nie z CSS-a.
- Przy przezroczystościach `color-mix(in srgb, var(--ink) 28%, transparent)`,
  nie `rgba()` z liczbami — inaczej nakładka nie odwróci się w ciemności.

## Tokeny — używaj zmiennych, nigdy wartości wprost

Nazwy podstawowe (jasny → ciemny):

| grupa | zmienne |
|---|---|
| powierzchnie | `--bg` #faf9f7 → #121110, `--surface` #fff → #1a1917, `--panel` #f2ede6 → #201e1b, `--bg-sunken` |
| linie | `--line` #e2ddd3 → #302d29, `--line-strong` |
| tekst | `--ink` #16150f → #f5f2ec, `--ink-2`, `--ink-3` (trzy stopnie nasycenia) |
| akcent | `--accent` rdza `oklch(.52 .15 40)` → amber `oklch(.78 .13 72)`, `--accent-soft` |
| przyciski | `--btn-bg`, `--btn-ink` — odwrócony kontrast wobec tła |
| zdjęcia | `--img`, `--img-line` (kafel i kreskowanie zastępcze) |
| status OK | `--ok`, `--ok-soft`, `--ok-ink` — dostępność i zamówienie zrealizowane |
| kształt | `--radius` 14, `--radius-sm` 10; aliasy `--r`, `--r-sm`, `--r-lg` 20, `--r-pill` 999 |
| cień | `--shadow` — tylko na interakcji, nigdy w stanie spoczynku |
| układ | `--maxw` 1160, `--gutter` 28, `--header-h` 72 |
| warstwy | `--z-header` 40, `--z-buybar` 60, `--z-drawer` 80, `--z-modal` 100, `--z-toast` 120 |

Blok „Aliasy zgodności" mapuje stare nazwy na nowe: `--bg-soft`/`--beige` →
`--panel`, `--ink-soft` → `--ink-2`, `--ink-faint` → `--ink-3`, `--on-accent` →
`--btn-ink`, `--sale` → `--accent`. W nowym kodzie pisz nazwami bazowymi;
aliasy zostają dla trzystu istniejących odwołań.

Uwaga na przesunięcie znaczeń: dawny `--accent` był grafitem tła przycisków —
dziś to `--btn-bg`. `--accent` to rdza/amber, czyli dawny `--sale`: przeceny,
gwiazdki, kropka w logo, aktywne obramowania.

`--ok` to jedyna zieleń w palecie i jedyny kolor statusu. Poza `--accent`
i `--ok` paleta jest monochromatyczna. Czerwień systemowa jest zakazana —
błąd niesie treść komunikatu, nie kolor.

Nigdy nie warto pisać `z-index` liczbą — pasek zakupu wylądowałby nad modalem.

## Zasady wizualne

- **Hairline zamiast ramki**: sekcje i siatki rozdziela `1px solid var(--line)`,
  nie obwódka wokół każdego elementu.
- **Cień tylko w ruchu**: karta w spoczynku jest płaska; `--shadow` pojawia się
  na `:hover`/`:focus-within` albo pod elementem unoszącym się nad treścią
  (modal, szuflada, pasek przyklejony).
- **Promienie**: pola i przyciski w pigułkach (`--r-pill`), kafle i karty `--r`,
  duże panele `--r-lg`.
- **Mikroetykiety**: `.label` — krój maszynowy, uppercase,
  `letter-spacing: .14em`, `--ink-3`. Odróżnia etykietę od treści bez koloru.
- **Liczby**: `font-variant-numeric: tabular-nums` (klasa `.num`) wszędzie, gdzie
  wartość się zmienia — ceny, liczniki, sumy.
- **Fokus**: `:focus-visible` ma globalny obrys `1.5px solid var(--ink)` z
  `outline-offset: 3px`. Nie kasuj go w komponencie.

## Typografia — trzy kroje

| rola | krój | zmienna | gdzie |
|---|---|---|---|
| display | **Instrument Serif** (400) | `--display` | `h1`, `h2`, `.logo` |
| interfejs | **Instrument Sans** (400/500/600) | `--sans` | reszta: `h3`, tabele, przyciski, pola, ceny |
| etykiety | **IBM Plex Mono** (400) | `--mono` | `.label`: nadtytuły, kategoria na karcie, nagłówki kolumn w stopce |

- Nagłówki szeryfowe: waga 400, `letter-spacing: -.012em`, `line-height: 1.08`.
  Nie ściskaj trackingu mocniej — serif zlepia się na zakończeniach liter.
- Nagłówki użytkowe (`.panel h2`, `.summary h2`, `.drawer-head h2`,
  `.card-box h3`, `.quick h2`) zostają przy groteskach: w rozmiarach ~1 rem
  serif tylko szumi. Dokładając taki nagłówek, dopisz jego selektor do tej listy.
- Podmiana kroju = zmiana zmiennej w bloku aliasów plus krój z `next/font` w
  `web/app/layout.tsx`. Wymóg twardy: subset **latin-ext** (ą ć ę ł ń ó ś ź ż).

## Ruch

Animujemy **wyłącznie `transform` i `opacity`** (oraz kolor). Nigdy `width`,
`height`, `top`, `margin` — to układ, nie kompozycja, i zjada klatki.

| rodzaj | czas | krzywa |
|---|---|---|
| hover, stan przycisku | 160–200 ms | `ease` |
| wejście przy przewijaniu | 500 ms opacity / 660 ms ruch | `cubic-bezier(.16, .84, .34, 1)` |
| rozwinięcie listy (sortowanie) | 200–300 ms | `cubic-bezier(.2, .7, .3, 1)` |
| szuflada, modal | 280–360 ms | `cubic-bezier(.2, .7, .3, 1)` |
| wyjście | ~⅔ czasu wejścia | `ease-in` |

- Dystans wejścia: 16–26 px plus `scale(.982)`. Ruch ma być zauważalny, nie teatralny.
- Kaskada w siatkach: `70 × √index` ms (0, 70, 99, 121…) — początek wyraźny,
  a ósmy kafelek nie każe czekać pół sekundy.
- Wejście animujemy **tylko od dołu**. Element wjeżdżający od góry (powrót,
  skok do kotwicy) dostaje klasę bez opóźnienia — animowanie go wygląda jak usterka.
- Ujawnianie jedzie na osobnych właściwościach `translate` i `scale`, nie na
  zbiorczym `transform` — inaczej kłóci się z uniesieniem kafelka na hover.
  Selektor `[data-reveal][data-reveal]` podbija swoistość ponad `.card`.
- Bez odbić i sprężyn **w ruchu podstawowym** — hover, wejścia, szuflady jadą
  spokojnie. Sprężystość jest zarezerwowana dla efektów z sekcji „Zaawansowany
  ruch" i dla serca listy życzeń; poza nimi nie ma czego odbijać.

## Zaawansowany ruch

Osobna warstwa, świadomie wyłamana z tabeli wyżej. Tamte czasy opisują ruch
**użytkowy** — reakcję na kliknięcie, wejście panelu, ujawnienie kafelka —
i tam sufit 400 ms dalej obowiązuje bez wyjątku. Efekty niżej nie reagują na
akcję, tylko budują charakter strony, i mają własne budżety czasu.

Zasada rozstrzygająca spór: **jeśli użytkownik czeka na wynik, obowiązuje
tabela wyżej.** Jeśli efekt dzieje się obok jego decyzji, wolno mu trwać dłużej.

| efekt | czas / parametr | krzywa | gdzie |
|---|---|---|---|
| marquee pod headerem | 30–45 s na pełną pętlę | `linear` | pasek promocji |
| pole cząsteczek | promień 120 px, powrót `*0.08`/klatkę | — | tło hero |
| dekodowanie nagłówka | 8 klatek na literę, kaskada 30 ms | `steps()` | `h1` hero |
| magnetyczny CTA | promień 14 px, dociąganie `*0.25` | — | główny przycisk |
| ripple | 600 ms, `scale(0)→scale(3)`, `opacity 1→0` | `cubic-bezier(.2,.7,.3,1)` | główny przycisk |
| liczniki | 900 ms | `easeOutCubic` | statystyki hero |
| sekcja przypięta | 2–3 kroki na wysokość sekcji | — | sekcja opowieści |
| spotlight | `clip-path: circle()` za kursorem | `ease-out` 120 ms | ciemny panel |
| przeciągana strzępka | bezwładność `velocity *= 0.94` | — | pozioma lista |
| tilt kart | ±8 deg | `ease` 160 ms | siatka katalogu |
| odometr ceny | 500 ms | `easeOutCubic` | karta produktu |
| własny kursor | dociąganie `*0.18`/klatkę | — | cała strona |

Cztery reguły obowiązujące każdy z nich, bez wyjątku:

1. **`clip-path` dołącza do dozwolonych właściwości** — obok `transform`
   i `opacity`. Nie kompozytuje się tak tanio, więc wolno go animować wyłącznie
   w spotlighcie i wyłącznie za kursorem, nigdy w pętli.
2. **Wszystko jedzie w `requestAnimationFrame`**, nigdy w `setInterval`, i musi
   mieć sprzątanie w `useEffect`. Efekt, który zostaje po odmontowaniu, to wyciek.
3. **`prefers-reduced-motion` wyłącza je całkowicie**, nie skraca. Marquee staje
   i pokazuje pierwszy komplet treści, cząsteczek nie ma, nagłówek jest od razu
   docelowy, licznik pokazuje wartość końcową, spotlight odsłania całość,
   kursor wraca do systemowego. Sprawdzenie w JS, nie w CSS — te efekty żyją
   w JavaScripcie i globalna reguła ich nie dosięga.
4. **Dotyk dostaje mniej.** Za `matchMedia('(hover: hover) and (pointer: fine)')`
   chowają się: własny kursor, magnetyczny CTA, tilt, spotlight i cząsteczki —
   wszystkie wymagają myszy, a na telefonie albo nie działają, albo psują
   przewijanie. Zostają: marquee, dekodowanie, liczniki, sekcja przypięta,
   przeciągana strzępka (tam dotyk jest naturalny) i odometr.

Ograniczenie ilościowe: **jeden mocny efekt na ekran**. Sekcja przypięta
i spotlight nie mogą stać obok siebie bez oddechu między nimi, a pole cząsteczek
wyklucza jakikolwiek inny ruch w tle tego samego bloku.

## prefers-reduced-motion — obowiązkowo

W `web/app/globals.css` stoi globalna reguła ścinająca czasy do `.01ms`. To nie zwalnia
z myślenia:

- Element ujawniany przy scrollu **nie może zostać niewidoczny**, gdy ruch jest
  wyłączony. Sprawdzaj w JS:
  `const still = matchMedia('(prefers-reduced-motion: reduce)').matches;`
  i przy `still` ustaw stan końcowy od razu, bez obserwatora.
- Efekty typu „pop" i parallax wyłączaj całkowicie, nie skracaj.

## Dostępność komponentów nakładkowych

Modal i szuflada:

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Escape zamyka, kliknięcie w tło zamyka
- focus wchodzi do panelu przy otwarciu i wraca na element wyzwalający przy zamknięciu
- `document.body` dostaje blokadę przewijania na czas otwarcia
- przycisk zamykający ma `aria-label`

Stany przełączane: `aria-pressed` (serce), `aria-expanded` (menu), `role="status"`
dla komunikatów (toast, licznik pozycji).

Własna lista wyboru (jak `.sortbox` w sklepie) zastępuje `<select>` tylko wtedy,
gdy naprawdę potrzebna jest animacja. Wymagane wtedy: `role="listbox"`,
`role="option"` + `aria-selected`, `aria-haspopup="listbox"` i `aria-expanded`
na przycisku, strzałki góra/dół, Home/End, Enter, Escape oraz zamykanie klikiem
poza obszarem.

## Konwencje kodu

- CSS dopisujesz do `web/app/globals.css` w sekcji tematycznej z komentarzem
  `/* ---------- Nazwa ---------- */`; kolejność jak w pliku: tokeny → baza →
  komponenty → widoki → media queries na końcu bloku komponentu.
- Komponenty: serwerowe domyślnie, `'use client'` tylko tam, gdzie potrzebny
  jest stan albo zdarzenie. Wyspy trzymamy małe — cały katalog nie ma po co
  lądować w bundlu.
- Ikony wyłącznie z `ICON_PATHS` w `web/components/Icon.tsx` (`<Icon name="…" />`), stroke 1.1.
- Zdjęcie produktu zawsze przez `<ProductMedia />` — sam decyduje, czy pokazać
  plik z kubełka, czy ikonę zastępczą. Nigdy `<img>` z ręki: kafle mediów mają
  swoje proporcje, `object-fit: cover` i wejście `media-in`, a ikona musi zostać
  dla produktów bez zdjęcia. `next/image` z `fill` wymaga pozycjonowanego
  rodzica — lista takich kontenerów jest na końcu globals.css.
- Komentarz po polsku tłumaczy **dlaczego**, nie co robi linijka.

## Czego nie robić

- **karuzeli produktów z autoprzewijaniem**, licznika odliczającego promocję,
  wyskakującego popupu z rabatem — to nie ten sklep. Marquee z sekcji
  „Zaawansowany ruch" nie jest wyjątkiem od tej reguły, tylko czym innym:
  przewija **tekst**, niczego nie ukrywa i nie zabiera pozycji z pola widzenia,
  a pod kursorem staje. Karuzela, w której produkt sam ucieka, zostaje zakazana.
- gradientów, neonów, kolorowych cieni
- koloru wpisanego wprost w regule komponentu ani `rgba()` z liczbami —
  jedno i drugie przeżyje przełączenie motywu i będzie świecić
- `z-index` liczbą zamiast tokenu warstwy
- **w ruchu użytkowym**: animacji dłuższych niż 400 ms i opóźnień większych
  niż 300 ms. Efekty z sekcji „Zaawansowany ruch" mają własne budżety i własną
  tabelę — sufit dotyczy tego, na co użytkownik czeka.
- `!important` (poza istniejącą regułą reduced-motion)
- efektu z sekcji „Zaawansowany ruch" **bez** wyłącznika `prefers-reduced-motion`
  i bez sprzątania w `useEffect` — jedno i drugie jest częścią efektu, nie
  dodatkiem do niego
