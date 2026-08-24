# Źródła — ruch i animacje

Wypisy pobrane z sieci 24 sierpnia 2026. Trzymam je osobno, żeby dało się
sprawdzić, skąd wzięła się każda liczba w [SKILL.md](../SKILL.md), i żeby przy
kolejnym przejściu było widać, co się w źródle zmieniło.

---

## Material Design 3 — Easing and duration

https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

Uwaga ze strony: w aktualizacji „expressive" komponenty przeszły na system
fizyczny oparty o sprężyny. System easing + duration nadal obowiązuje dla
przejść i jest wspierany dla zespołów, które nie migrowały — ale nie jest już
rozwijany.

### Krzywe, wartości CSS

Zestaw wyrazisty (emphasized) — „najczęstszy, oddaje wyrazisty styl M3":

| nazwa | CSS |
|---|---|
| emphasized | brak odpowiednika w CSS, jako zamiennik standard |
| emphasized decelerate | `cubic-bezier(0.05, 0.7, 0.1, 1.0)` |
| emphasized accelerate | `cubic-bezier(0.3, 0.0, 0.8, 0.15)` |

Zestaw standardowy — „proste, małe, użytkowe przejścia":

| nazwa | CSS |
|---|---|
| standard | `cubic-bezier(0.2, 0.0, 0, 1.0)` |
| standard decelerate | `cubic-bezier(0, 0, 0, 1)` |
| standard accelerate | `cubic-bezier(0.3, 0, 1, 1)` |

### Czasy, tokeny

Krótkie — drobne przejścia użytkowe:

| token | wartość |
|---|---|
| short1 | 50 ms |
| short2 | 100 ms |
| short3 | 150 ms |
| short4 | 200 ms |

Średnie — przejścia przez średni obszar ekranu:

| token | wartość |
|---|---|
| medium1 | 250 ms |
| medium2 | 300 ms |
| medium3 | 350 ms |
| medium4 | 400 ms |

Długie — zwykle w parze z easingiem wyrazistym, duże przejścia:

| token | wartość |
|---|---|
| long1 | 450 ms |
| long2 | 500 ms |
| long3 | 550 ms |
| long4 | 600 ms |

Bardzo długie — rzadkie, zwykle ruch bez udziału człowieka:

| token | wartość |
|---|---|
| extra-long1 | 700 ms |
| extra-long2 | 800 ms |
| extra-long3 | 900 ms |
| extra-long4 | 1000 ms |

Przykłady dopasowania podane przez M3:

- kontrolki wyboru — 200 ms, easing standardowy
- FAB rozwijający się w arkusz — 400 ms, easing wyrazisty
- karta rozwijana na pełny ekran — 500 ms, easing wyrazisty
- karuzela przewijająca się sama — 1000 ms, easing wyrazisty

---

## Nielsen Norman Group — Executing UX Animations: Duration and Motion Characteristics

https://www.nngroup.com/articles/animation-duration/

- Ogólny zakres: **100–500 ms**.
- Proste zdarzenia zwrotne (checkbox, przełącznik): **około 100 ms** — „feels
  immediate", daje złudzenie fizycznej manipulacji, a nadal jest widoczne.
- Poważniejsze zmiany ekranu (okno modalne): **200–300 ms**, czas rośnie razem
  z drogą, jaką element pokonuje.
- Praktyczne maksimum: **400–500 ms**. Przy 500 ms animacja „start to feel like
  a real drag for users".
- Częstszy błąd to animacja za długa niż za krótka.
- Im dłuższa droga, tym ważniejsze, żeby ruch był płynny i nieszarpany.
- Asymetria kierunku: wejście na ekran potrzebuje nieco dłuższego czasu niż
  wyjście — np. 300 ms na pojawienie się, 200–250 ms na zniknięcie.

---

## Apple — Human Interface Guidelines, Motion

https://developer.apple.com/design/human-interface-guidelines/motion

- „Add motion purposefully, supporting the experience without overshadowing it.
  Don't add motion for the sake of adding motion." Nadmiar rozprasza i może
  wywołać fizyczny dyskomfort.
- **Ruch ma być opcjonalny.** Nie wolno robić z animacji jedynego nośnika
  ważnej informacji; wsparcie przez inne kanały (haptyka, dźwięk, tekst).
- Ruch zwrotny ma odpowiadać gestowi. Jeśli widok wjechał z góry pociągnięciem
  w dół, nikt nie spodziewa się, że zamknie go ruch w bok.
- Zwięzłość i precyzja: krótka animacja przypięta dokładnie do zdarzenia niesie
  informację lepiej niż animacja okazała.
- W aplikacjach zwykle **nie animuj interakcji, które zdarzają się często**.
  System sam daje subtelne przejścia dla elementów standardowych.
- „Let people cancel motion" — nie każ czekać na koniec animacji, zwłaszcza gdy
  ktoś ma ją obejrzeć więcej niż raz.
- Dla gier: stała klatka 30–60 fps.

---

## Emil Kowalski — Great animations

https://emilkowal.ski/ui/great-animations

- Domyślnie **`ease-out`**: szybki start, wyhamowanie na końcu, wrażenie
  natychmiastowej reakcji.
- **Poniżej 300 ms** dla animacji interfejsu.
- Samo `ease` z wolniejszym czasem bywa bardziej eleganckie niż agresywne
  `ease-out`.
- **Animuj wyłącznie `transform` i `opacity`** — tylko one ograniczają się do
  etapu kompozycji; `padding`/`margin` uruchamiają layout, paint i composite,
  czyli trzykrotność pracy.
- Używaj przejść CSS albo Web Animations API; `requestAnimationFrame` nie jest
  akcelerowane sprzętowo.
- **Nie animuj czynności wywoływanych klawiaturą** — użytkownik powtarza je
  setki razy dziennie.
- **Przerywalność** jest warunkiem naturalności. Przejścia CSS mają ją
  wbudowaną: potrafią płynnie zmienić cel, zanim dojadą do końca.
- Dostępność: `@media (prefers-reduced-motion: reduce)`, bo ruch potrafi wywołać
  mdłości u osób wrażliwych przedsionkowo.
- Czas i charakter ruchu mają pasować do tonu marki.
- Wróć do animacji po dobie — świeże oko wyłapie niedoróbki niewidoczne
  w trakcie pracy.

---

## W3C — WCAG 2.2, kryterium 2.3.3 Animation from Interactions

https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

- Ruch animacyjny wywołany interakcją **musi dać się wyłączyć**, chyba że jest
  niezbędny do działania funkcji albo przekazania informacji.
- Wystarczy jedno z trzech: usunąć zbędne animacje, dać przełącznik, albo
  uszanować `prefers-reduced-motion` z systemu lub przeglądarki.
- Zwolnione są animacje niezbędne — takie, których nie da się zastąpić bez
  utraty funkcji.
- Samo wchodzenie treści w pole widzenia przy przewijaniu jest dozwolone, ale
  animacje doczepione do przewijania muszą dać się wyłączyć.

---

## Laws of UX — próg Doherty'ego i reszta

https://lawsofux.com/

- **Doherty Threshold**: wydajność skacze, gdy maszyna i człowiek odpowiadają
  sobie w tempie poniżej **400 ms** — wtedy żadna strona nie czeka na drugą.
- **Fitts's Law**: czas trafienia w cel zależy od odległości i wielkości celu.
- **Hick's Law**: czas decyzji rośnie z liczbą i złożonością opcji.
- **Jakob's Law**: ludzie spędzają czas na innych stronach i oczekują, że nasza
  zadziała tak samo jak tamte.
- **Aesthetic-Usability Effect**: ładniejszy interfejs bywa odbierany jako
  wygodniejszy.
