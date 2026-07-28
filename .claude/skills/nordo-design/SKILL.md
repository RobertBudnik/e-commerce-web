---
name: nordo-design
description: Design system i reguły ruchu sklepu Nordo — tokeny, komponenty, animacje. Użyj przy każdej zmianie w css/style.css, przy dodawaniu komponentów UI (modale, szuflady, paski postępu, karty) oraz gdy pojawia się prośba o animacje, mikrointerakcje albo „ładniejszy" wygląd.
---

# Nordo — design i ruch

Statyczny sklep: czysty HTML + CSS + JS, zero zależności, zero kroku budowania.
Motyw wyłącznie jasny. Zmiany mają wyglądać, jakby były tu od początku.

## Tokeny — używaj zmiennych, nigdy wartości wprost

| grupa | zmienne |
|---|---|
| powierzchnie | `--bg` #fff, `--bg-soft` #f7f5f0, `--bg-sunken` #efeae1, `--beige` #f2ede4, `--surface` |
| linie | `--line` #e9e4da, `--line-strong` #d9d2c5 |
| tekst | `--ink` #1a1815, `--ink-soft` #57534c, `--ink-faint` #8d877d |
| akcent | `--accent` (grafit), `--accent-hover` #000, `--on-accent` #fff, `--sale` #a2603f |
| kształt | `--r-sm` 8, `--r` 14, `--r-lg` 20, `--r-pill` 999 |
| cień | `--shadow` — tylko na interakcji, nigdy w stanie spoczynku |
| układ | `--maxw` 1160, `--gutter` 28, `--header-h` 72 |

Nowy kolor dokładasz wyłącznie jako token w `:root`. Terakota `--sale` to jedyny
kolor poza monochromem — zostaje przy przecenach, cenach promocyjnych i sercu
listy życzeń. Zieleń i czerwień z palety systemowej są zakazane.

## Zasady wizualne

- **Hairline zamiast ramki**: sekcje i siatki rozdziela `1px solid var(--line)`,
  nie obwódka wokół każdego elementu.
- **Cień tylko w ruchu**: karta w spoczynku jest płaska; `--shadow` pojawia się
  na `:hover`/`:focus-within` albo pod elementem unoszącym się nad treścią
  (modal, szuflada, pasek przyklejony).
- **Promienie**: pola i przyciski w pigułkach (`--r-pill`), kafle i karty `--r`,
  duże panele `--r-lg`.
- **Mikroetykiety**: `.label` — uppercase, `letter-spacing: .14em`, `--ink-faint`.
- **Liczby**: `font-variant-numeric: tabular-nums` (klasa `.num`) wszędzie, gdzie
  wartość się zmienia — ceny, liczniki, sumy.

## Typografia — dwa kroje

| rola | krój | zmienna | gdzie |
|---|---|---|---|
| display | **Fraunces** (zmienny, `opsz` 9–144) | `--display` | `h1`, `h2`, `.logo` |
| interfejs | **Inter** | `--sans` | reszta: `h3`, tabele, przyciski, pola, ceny |

- Nagłówki szeryfowe: waga 400, `letter-spacing: -.012em`, `line-height: 1.08`.
  Nie ściskaj trackingu mocniej — serif zlepia się na zakończeniach liter.
- Nagłówki użytkowe (panel konta, podsumowanie, szuflada, karta w modalu)
  zostają przy Interze: w rozmiarach ~1 rem serif tylko szumi.
- Podmiana kroju = zmiana `--display` w `:root` plus `<link>` w plikach HTML.
  Wymóg twardy: subset **latin-ext** (polskie znaki ą ć ę ł ń ó ś ź ż).

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
- Bez odbić i sprężyn poza jednym akcentem (serce listy życzeń) — reszta jedzie
  spokojnie, zgodnie z charakterem sklepu.

## prefers-reduced-motion — obowiązkowo

W `css/style.css` stoi globalna reguła ścinająca czasy do `.01ms`. To nie zwalnia
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

- CSS dopisujesz do `css/style.css` w sekcji tematycznej z komentarzem
  `/* ---------- Nazwa ---------- */`; kolejność jak w pliku: tokeny → baza →
  komponenty → widoki → media queries na końcu bloku komponentu.
- JS: moduł jako obiekt z `init()`/`open()`/`close()`, wpięty w bootstrap
  `DOMContentLoaded` w `js/app.js`. Delegacja zdarzeń na `document`, nie listener
  na każdym kafelku.
- Markup generujesz przez `escapeHtml()` dla wszystkiego, co pochodzi z danych.
- Ikony wyłącznie z `ICON_PATHS` w `js/icons.js` (`icon('nazwa')`), stroke 1.1.
- Komentarz po polsku tłumaczy **dlaczego**, nie co robi linijka.

## Czego nie robić

- karuzeli z autoprzewijaniem, licznika odliczającego promocję, wyskakującego
  popupu z rabatem — to nie ten sklep
- gradientów, neonów, kolorowych cieni
- animacji dłuższych niż 400 ms i opóźnień większych niż 300 ms
- `!important` (poza istniejącą regułą reduced-motion)
