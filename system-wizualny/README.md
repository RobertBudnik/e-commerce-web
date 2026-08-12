# System wizualny — editorial

Żywy styleguide sklepu: React 19 + Vite + Tailwind CSS v4.
Osobna aplikacja obok `web/` (Next.js), własny port, własne zależności.

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

Nie zmienia sklepu w `web/`. Tamten front jedzie na własnym `globals.css` bez
Tailwinda — przeniesienie systemu na produkcję to osobna praca, do zaplanowania
świadomie, ekran po ekranie.

Nie ma jeszcze motywu ciemnego. Przełącznik w belce jest atrapą, bo
specyfikacja opisuje jedną paletę; ciemna wymaga drugiego kompletu wartości
w `@theme` i decyzji, co robi terakota na ciemnym tle.
