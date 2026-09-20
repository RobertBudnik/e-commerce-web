---
name: ruch-i-animacje
description: Zasady ruchu w interfejsie sklepu — czasy trwania, krzywe easing, które właściwości CSS wolno animować, przerywalność, kiedy nie animować i jak uszanować prefers-reduced-motion. Reguły pochodzą z zewnętrznych źródeł (Material Design 3, Apple HIG, Nielsen Norman Group, WCAG 2.2, animations.dev), każda z linkiem. Użyj zawsze, gdy pada „animacja", „przejście", „hover", „mikrointerakcja", „płynność", „fade", „slide", „scroll reveal", „motion", a także przy każdej pracy w web/components/ruch/, przy `transition` i `@keyframes` w globals.css i przy dodawaniu ruchu do nowego ekranu.
---

# Ruch w interfejsie sklepu

Ten plik nie jest zbiorem opinii. Każda reguła ma źródło i link — bo o czasach
animacji łatwo się kłócić bez końca, a policzone badania i systemy projektowe
mówią zgodnie prawie to samo.

Pełne wypisy ze źródeł, z liczbami i cytatami:
[references/zrodla.md](references/zrodla.md).

## Reguła nadrzędna: animacja ma zadanie

Ruch bez zadania to koszt bez zysku. Zanim dodasz animację, nazwij jej robotę —
jedną z czterech:

- **informacja zwrotna** — kliknięcie zadziałało
- **orientacja** — skąd się ten panel wziął i dokąd zniknie
- **skupienie** — tu się coś zmieniło, popatrz
- **ciągłość** — to ten sam obiekt, tylko w innym miejscu

Apple mówi to wprost: „Don't add motion for the sake of adding motion" —
nadmiarowa animacja rozprasza i potrafi wywołać dyskomfort fizyczny
([Apple HIG, Motion](https://developer.apple.com/design/human-interface-guidelines/motion)).

## Czasy

Widełki zgodne u wszystkich źródeł: **100–500 ms**, przy czym w interfejsie
użytkowym prawie wszystko mieści się w 200–300 ms.

| co | czas | skąd |
|---|---|---|
| przełącznik, checkbox, drobna zmiana stanu | 100–200 ms | NN/g; M3 `short2`–`short4` |
| hover, zmiana koloru, cień | 150–200 ms | M3 `short3`–`short4` |
| wejście panelu, modal, arkusz | 250–300 ms | NN/g; M3 `medium1`–`medium2` |
| duże przejście przez pół ekranu | 400–500 ms | M3 `medium4`–`long2` |
| ruch bez udziału człowieka (karuzela) | 700–1000 ms | M3 `extra-long` |

Trzy rzeczy do zapamiętania:

1. **Wyjście krócej niż wejście.** NN/g podaje przykład: 300 ms na pojawienie
   się, 200–250 ms na zniknięcie. Element, który znika, już nikogo nie
   interesuje.
2. **Dłuższa droga to dłuższy czas** — ale w tych samych widełkach. Im dalej
   coś jedzie, tym bardziej boli szarpnięcie.
3. **Powyżej 500 ms robi się wleczenie.** NN/g: przy 500 ms animacja zaczyna
   być dla użytkownika udręką. Emil Kowalski trzyma UI poniżej 300 ms.

Osobna granica, nie od animacji, ale warto ją znać: **próg Doherty'ego, 400 ms**
— poniżej tego czasu odpowiedzi maszyny człowiek nie odbiera jako czekania
([Laws of UX](https://lawsofux.com/)).

## Krzywe

Zasada kierunkowa:

- **wejście na ekran → `ease-out`** (szybki start, miękkie dojście) — element
  natychmiast reaguje, a potem się odkłada
- **wyjście z ekranu → `ease-in`**
- **zmiana w miejscu → `ease-in-out`**
- **`linear` tylko dla ruchu ciągłego** (spinner, pasek postępu). W interfejsie
  liniowy ruch wygląda mechanicznie.

Konkretne wartości z Material Design 3 — te wpisuj, nie zgaduj
([M3, Easing and duration](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)):

```css
/* zestaw standardowy — drobne, użytkowe przejścia */
--ease-standard:            cubic-bezier(0.2, 0.0, 0.0, 1.0);
--ease-standard-decelerate: cubic-bezier(0.0, 0.0, 0.0, 1.0);
--ease-standard-accelerate: cubic-bezier(0.3, 0.0, 1.0, 1.0);

/* zestaw wyrazisty — duże przejścia, gdy ruch ma być zauważony */
--ease-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1.0);
--ease-emphasized-accelerate: cubic-bezier(0.3, 0.0, 0.8, 0.15);
```

Emil Kowalski dodaje niuans: samo `ease` bywa bardziej eleganckie niż ostre
`ease-out` — wolniejsze, spokojniejsze. Przy sklepie, który ma wyglądać
drogo, to jest właściwy wybór częściej, niż się wydaje
([Great animations](https://emilkowal.ski/ui/great-animations)).

## Co wolno animować

**Tylko `transform` i `opacity`.** Nic innego.

Powód jest mechaniczny, nie estetyczny: te dwie właściwości przechodzą wyłącznie
przez etap kompozycji. `padding`, `margin`, `width`, `height`, `top` uruchamiają
layout → paint → composite, czyli trzy razy więcej pracy na każdej klatce
([Great animations](https://emilkowal.ski/ui/great-animations)).

Praktycznie znaczy to tyle:

- przesunięcie → `translate`, nie `top`/`margin`
- powiększenie → `scale`, nie `width`/`height`
- pojawienie się → `opacity`, nie `display` ani `visibility`

## Przerywalność

Animacja, której nie da się przerwać, kłamie — bo interfejs udaje, że jest
zajęty, choć nie jest. Zmiana stanu w połowie ruchu ma płynnie przejść do
nowego celu, a nie czekać na koniec poprzedniego.

Przejścia CSS (`transition`) mają to za darmo. `@keyframes` już nie — animacja
klatkowa dojeżdża do końca. Przy stanach sterowanych hoverem albo kliknięciem
używaj `transition`.

Apple: „don't make people wait for an animation to complete before they can do
anything" ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/motion)).

## Kiedy nie animować

- **Czynności powtarzane setki razy.** Skróty klawiszowe, przewijanie listy
  w magazynie, skanowanie kodów. Animacja obejrzana dwudziesty raz w ciągu
  minuty jest podatkiem, nie ozdobą.
- **Elementy standardowe.** System i przeglądarka mają własne subtelne
  przejścia. Dokładanie swoich to zwykle pogorszenie.
- **Rzeczy krytyczne czasowo.** Komunikat o błędzie płatności ma się pokazać,
  nie wpłynąć.

## Dostępność — to jest wymóg, nie miła opcja

WCAG 2.2, kryterium 2.3.3 „Animation from Interactions": ruch wywołany
interakcją musi dać się wyłączyć, chyba że jest niezbędny do działania funkcji.
Uszanowanie `prefers-reduced-motion` jest wystarczającą techniką
([W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).

Wzór do skopiowania:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Uwaga na sens tego zapisu: „reduce" nie znaczy „wyłącz wszystko". Przejście
opacity zwykle zostaje — nie rusza obrazu w przestrzeni, więc nie wywołuje
mdłości. Kasuje się ruch: przesunięcia, skalowanie, paralaksę, przewijanie
sterowane skryptem.

Apple dokłada regułę, o której łatwo zapomnieć: **ruch nie może być jedynym
nośnikiem informacji.** Jeśli animacja mówi „zapisano", to samo musi mówić
tekst.

## Spójność

Ten sam rodzaj zdarzenia dostaje ten sam ruch — ten sam czas, tę samą krzywą.
Karta produktu na stronie głównej i w wynikach wyszukiwania podnosi się tak
samo. Inaczej ruch przestaje być językiem, a staje się szumem.

Dlatego czasy i krzywe mają siedzieć w tokenach w `globals.css`, a nie
w komponentach.

## Zanim uznasz animację za skończoną

Emil Kowalski: wróć do niej po dobie. Ruch, który po dniu przerwy wygląda
o pół kroku za wolno albo o włos za daleko, jest do poprawienia — na świeżo
tego nie widać, bo oko przywyka do własnej roboty.
