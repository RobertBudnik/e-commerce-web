# Dostępność i ruch — lista kontrolna

Poziom docelowy: **WCAG 2.2 AA**. Stan na sierpień 2026.

## Kontrast

| co | próg |
|---|---|
| tekst zwykły | 4,5:1 |
| tekst duży (≥ 24 px, albo ≥ 18,66 px przy grubości ≥ 700) | 3:1 |
| granice kontrolek, ikony niosące treść | 3:1 (SC 1.4.11) |

Palety nie da się rzetelnie zmierzyć z DOM-u — `color-mix()` i `oklch()`
psują odczyt przez `getComputedStyle`, a `canvas.fillStyle` normalizuje je
niekonsekwentnie. **Kontrast liczyć z tokenów**, skryptem, nie na oko.

Stan tokenów Nordo (motyw jasny; ciemny jest wszędzie ≥ 4,2):

| | bg | surface | panel | bg-sunken |
|---|---|---|---|---|
| `--ink` | 17,4 | 18,3 | 15,7 | 14,3 |
| `--ink-2` | 6,5 | 6,9 | 5,9 | 5,4 |
| `--ink-3` | 5,0 | 5,3 | 4,5 | **4,1** |
| `--accent` | 5,6 | 5,9 | 5,1 | 4,6 |

- [ ] `--ink-3` na `--bg-sunken` = 4,13:1 — poniżej progu dla tekstu zwykłego.
- [ ] `--line` do `--bg` = **1,29:1**. Pola formularza mają tło równe tłu strony,
      więc obwódka jest jedynym wskaźnikiem kontrolki — to łamie SC 1.4.11.
      `--line-strong` daje 1,52, też za mało. Potrzebny osobny token obwódki
      pola o kontraście ≥ 3:1 wobec `--bg`.

Źródło: [SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Cele dotykowe

Dwa różne progi, nie mylić ich:

- **WCAG 2.2 AA, SC 2.5.8** — minimum **24×24 CSS px**, z wyjątkiem odstępu:
  jeśli wokół celu zmieści się okrąg o średnicy 24 px nienachodzący na inne
  cele, mniejszy cel przechodzi.
- **HIG Apple** — zalecane **44×44 pt**. To zalecenie, nie warunek zgodności,
  ale dla narzędzia obsługiwanego w rękawicach w magazynie jest ważniejsze
  niż WCAG.

Stan projektu:

- [x] `.btn`, `.wish-btn`, `.card-quick` — twarde `min-height: 44px`, trzymają.
- [x] `.mag-segment` 32–36 px — tyle ma natywny segmented control Apple'a,
      zostawiamy świadomie.
- [ ] Linki w stopce i nawigacji: **17–18 px** wysokości. Poniżej 24 px, więc
      przechodzą tylko dzięki wyjątkowi odstępu — a ten trzeba sprawdzić,
      nie założyć.

Źródło: [SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Nazwy dostępne

- [ ] **Przycisk nie może zostać bez nazwy.** W nagłówku na wąskim ekranie
      `.cart-btn { font-size: 0 }` chowa napis, a plakietka z liczbą ma
      `hidden` przy zerze — przy pustym koszyku zostaje goła obwódka, którą
      VoiceOver czyta jako „przycisk". Jeśli etykieta znika wizualnie, musi
      zostać `aria-label` albo ikona z `<title>`.
- [x] Ikony dekoracyjne mają `aria-hidden="true"`.
- [x] Przyciski ikonowe (`.wish-btn`) mają `aria-label`.

Reguła: klasa chowająca tekst nigdy nie może być jedynym nośnikiem nazwy.

## Ognisko klawiatury

Uwaga na numery kryteriów — łatwo je pomylić:

- **SC 2.4.11 Focus Not Obscured (AA)** — element z ogniskiem nie może być
  całkowicie zasłonięty przez inną treść (paski przyklejone, szuflady, modale).
- **SC 2.4.13 Focus Appearance (AAA)** — to stąd bierze się reguła o obrysie
  ≥ 2 px i kontraście ≥ 3:1. Poziom AAA, czyli **nie jest warunkiem zgodności
  AA**, ale to dobra poprzeczka.

- [x] `:focus-visible` ustawione globalnie: obrys 1,5 px w kolorze `--ink`,
      odsunięty o 3 px. Kontrast wobec tła 17,4:1 — z ogromnym zapasem.
- [ ] Sprawdzić SC 2.4.11: czy pasek zakupu (`--z-buybar`) i szuflada koszyka
      nie zasłaniają elementu, który właśnie dostał ognisko.

## Ruch

- [x] `@media (prefers-reduced-motion: reduce)` obecne w ośmiu miejscach
      `globals.css`, z globalną regułą ścinającą czasy do zera.
- [x] Animacje służą sprzężeniu zwrotnemu (skok licznika koszyka), nie ozdobie.
- [ ] Nowe animacje **zawsze** z wariantem `reduce`. Sama reguła globalna nie
      wystarczy, gdy animacja siedzi w `transform` na pseudoelemencie.

Mapowanie na kryteria: `prefers-reduced-motion` obsługuje SC 2.2.2
(Pause, Stop, Hide) i 2.3.3 (Animation from Interactions).

Źródło: [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).

## Język i odmiana

- [x] `<html lang="pl">`.
- [ ] Liczebniki przez `Intl.PluralRules('pl-PL')`. Polski ma trzy formy;
      `${n} pozycji` daje „1 pozycji" na karcie każdego zamówienia
      z jedną pozycją.

```ts
const form = new Intl.PluralRules('pl-PL');
const odmien = (n: number, [jeden, kilka, wiele]: [string, string, string]) =>
  ({ one: jeden, few: kilka, many: wiele, other: wiele })[form.select(n)];

odmien(1, ['pozycja', 'pozycje', 'pozycji']);  // pozycja
odmien(2, ['pozycja', 'pozycje', 'pozycji']);  // pozycje
odmien(5, ['pozycja', 'pozycje', 'pozycji']);  // pozycji
```

## Semantyka koloru

Token akcentu (`--accent`) niesie w tym projekcie znaczenie: przecena, pilne,
wyróżnienie. Nie używać go do rzeczy neutralnych tylko dlatego, że przechodzi
próg kontrastu.

- [ ] Godziny w kolejce zamówień jadą dziś na `--accent` i czytają się jak
      ostrzeżenie. `--ink-2` daje 5,36:1 na wpuszczonym torze — przechodzi AA
      i jest neutralny.

## Jak to sprawdzać

- **[auto]** Kontrast tokenów: skrypt liczący pary z `:root` i `.dark`.
- **[auto]** Cele dotykowe i przepełnienie w poziomie: przebieg Playwrighta
  w kadrze telefonu, mierzący `getBoundingClientRect` wszystkich elementów
  interaktywnych.
- Ręcznie: VoiceOver na iPhonie po ekranach magazynu, raz na wydanie.

Testy pisać w **WebKicie**, nie tylko w Chromium — to ten sam silnik, co
`WKWebView` i Safari, czyli jedyne, na czym ta aplikacja naprawdę chodzi.
