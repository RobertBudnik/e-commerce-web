# System wizualny — editorial (zapis kierunku, nie stan sklepu)

> **To nie jest styleguide dzisiejszego sklepu.** Opisuje kierunek editorial:
> beż `#f5f2ec`, terakota `#c86030`, Instrument Serif od 20 px wzwyż. Sklep
> jedzie od dwóch rund neutralnym KokonutUI — szarość bez ani jednej barwy,
> Geist w każdym stopniu, akcent `#171717`. Nic z wartości poniżej nie zgadza
> się z produkcją.
>
> Źródłem prawdy dla sklepu jest `web/app/globals.css` (tokeny w dwóch blokach
> na górze pliku) oraz projekt w Figmie. Kontrast obu palet mierzy
> `npm run kontrast`.
>
> Zostaje jako zapis: te komponenty pokazują, jak kierunek wyglądał złożony
> w całość, i to się czasem przydaje przy decyzji, dokąd wracać. Gdyby przestał
> się przydawać — do skasowania w całości, nie do doklejania do niego dzisiejszej
> palety.

React 19 + Vite + Tailwind CSS v4. Osobna aplikacja obok `web/` (Next.js),
własny port, własne zależności.

```bash
npm --prefix system-wizualny run dev     # http://localhost:5180
npm --prefix system-wizualny run build
npm --prefix system-wizualny run typecheck
```

## Gdzie co jest

| plik | zawartość |
|---|---|
| `src/index.css` | **jedyne** miejsce z wartościami: `@theme static` (kolory, kroje), skala typograficzna, przyciski, pola |
| `src/components/podstawy.tsx` | Button, Badge, Avatar, Naglowek, Sekcja, Stat, Kafle, Tabela |
| `src/components/nawigacja.tsx` | belka sklepu (52 px) i belka panelu (44 px) |
| `src/components/karty.tsx` | karta produktu, kadr prezentacji, formatowanie ceny |
| `src/components/tokeny.tsx` | legenda palety — czyta wartości z CSS-a przez `getComputedStyle` |
| `src/App.tsx` | strona dokumentacji złożona z danych, nie z powtórzonego JSX-a |

## Zasady, na których to stoi

**Jedno źródło wartości.** Żaden komponent nie zapisuje koloru ani kroju wprost;
wszystko idzie przez tokeny z `@theme static`. Legenda w dokumentacji odczytuje
je z DOM-u, więc nie potrafi rozjechać się z paletą. `static` jest konieczne —
domyślnie Tailwind v4 wypisuje tylko zmienne użyte przez jakieś utility, a token
palety ma istnieć, zanim ktokolwiek po niego sięgnie.

**Serif od 20 px wzwyż.** Instrument Serif ma wysoki kontrast kreski i poniżej
tej wielkości szarzeje. Wszystko drobniejsze — tabele, etykiety, przyciski —
należy do Intera.

**Pigułka to jedyny wyjątek od kanciastości.** Przyciski, znaczniki i pole
szukania mają `9999px`; karty 12 px; pole formularza 6 px, bo stoi w kolumnie
z innymi polami i pigułki rozbijają tam rytm.

**Kolor niesie informację, nie dekorację.** Stany zamówienia dzielą jeden
neutralny odcień; zieleń i bursztyn zostają dla płatności, terakota dla danych
i rabatu. Inaczej tabela zamienia się w witraż, w którym nic nie wystaje.

## Czego to nie robi

Nie zmienia sklepu w `web/` i nie opisuje go. Tamten front jedzie na własnym
`globals.css` bez Tailwinda, w innej palecie i innym kroju — przeniesienie
tego systemu na produkcję nigdy nie doszło do skutku, a produkcja poszła
w drugą stronę.

Nie ma motywu ciemnego. Przełącznik w belce jest atrapą, bo specyfikacja
opisywała jedną paletę. Sklep ma dziś dwa motywy — ten zapis został przy
jednym i przy nim zostaje.
