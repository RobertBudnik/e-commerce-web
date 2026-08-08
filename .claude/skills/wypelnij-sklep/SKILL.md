---
name: wypelnij-sklep
description: Prowadzi właściciela przez wywiad i wypełnia szablon sklepu jego marką i danymi firmy — nazwa, hasła, obietnice handlowe, dane sprzedawcy, warunki sprzedaży. Pyta blokami, tłumaczy przy każdym polu, po co jest i czym grozi zła odpowiedź, po czym zapisuje wszystko do web/lib/dane-sklepu.ts i docs/dane-sprzedawcy.md. Użyj zawsze, gdy pada „mam już nazwę", „założyłem firmę", „mam NIP", „chcę wypełnić stronę", „co mam gdzie wpisać", „przygotuj sklep do startu", „ruszamy ze sprzedażą", „rebranding", „podmień treści", a także gdy ktoś prosi o pomoc w wymyśleniu nazwy, hasła albo opisu dla tego sklepu. Użyj też, gdy w kodzie zostały znaczniki ⟨…⟩ i trzeba je pozamieniać na prawdziwe treści.
---

# Wypełnianie sklepu

Ten sklep jest szablonem. Wszystko, co odróżnia go od innego wdrożenia, siedzi
w [`web/lib/dane-sklepu.ts`](../../../web/lib/dane-sklepu.ts) i jest oznaczone
znacznikiem `⟨…⟩`, widocznym na stronie do czasu wypełnienia. Twoim zadaniem jest
przeprowadzić właściciela przez te pola i zamienić znaczniki na prawdziwe treści.

To rozmowa, nie formularz. Właściciel zwykle nie wie, że „opis meta" pojawia się
w Google, ani że zdanie o wysyłce w 24 h jest wobec kupującego wiążące. Wie za to,
co sprzedaje i komu — i to z tego trzeba wyciągnąć resztę.

## Dwie natury pytań, dwa różne zachowania

Ta różnica przechodzi przez cały wywiad i jest ważniejsza niż kolejność pytań.

**Marka to propozycje.** Nazwa, hasło, akapit pod hasłem, tekst w sekcji
wyróżnionej. Tu właściciel często nie ma gotowej odpowiedzi i pyta „a co byś dał?".
Wtedy proponuj — dwie, trzy wersje o różnym charakterze, krótko uzasadnione,
z pytaniem, która jest bliżej. Nie każ mu pisać copywritingu od zera, skoro
przyszedł z pomysłem na sklep, a nie z briefem.

**Prawo i handel to fakty.** Nazwa firmy, adres, NIP, REGON, terminy, ceny
dostawy, gwarancja. Tu **nie proponujesz nic**. Zapisujesz dosłownie to, co
usłyszysz. Wymyślony NIP albo „przykładowy" adres trafi do regulaminu, a potem
do sporu z klientem — a właściciel będzie odpowiadał za treść, której nigdy nie
czytał. Czego nie wie, zostaw jako `⟨…⟩` i idź dalej: jedno nieuzupełnione pole
jest lepsze niż dwadzieścia dziewięć zmyślonych.

Granica bywa nieoczywista. „Wysyłka w 24 h" brzmi jak hasło reklamowe, a jest
zobowiązaniem. Jeśli wahasz się, po której stronie leży pole — potraktuj je jak
fakt i zapytaj, zamiast zaproponować.

## Przebieg

### 1. Zobacz, o co pytać

```bash
node .claude/skills/wypelnij-sklep/scripts/zbierz-pytania.mjs
```

Skrypt przechodzi repozytorium, znajduje każdy znacznik `⟨…⟩` i wypisuje przy nim
blok, nazwę pola, treść znacznika oraz komentarz stojący nad polem w kodzie.
Ten komentarz to gotowe wyjaśnienie „po co to jest" — używaj go w rozmowie,
zamiast pisać własne.

Lista nie jest nigdzie wpisana na sztywno i to jest celowe: konfiguracja będzie
rosła, a wywiad przepisany ręcznie rozjechałby się z nią po pierwszym nowym polu.
Jeśli skrypt czegoś nie pokazuje, znaczy to, że pole jest już wypełnione —
nie dopytuj o nie ponownie.

Przydaje się też przy powrocie do przerwanej rozmowy: `--blok SPRZEDAWCA`
zawęża do jednej sekcji, `--json` daje maszynowy odczyt.

### 2. Rozmawiaj blokami

Kolejność bloków i to, co dopytać w każdym, jest w
[references/wywiad.md](references/wywiad.md). Trzymaj się jej — jest ułożona tak,
żeby zacząć od rzeczy, które właściciel ma w głowie, a dopiero potem wejść
w dokumenty.

Trzy rzeczy o samym prowadzeniu rozmowy:

**Pytaj po kilka naraz, nie po jednym.** Blok to trzy do sześciu pól. Jedno
pytanie na wiadomość zamienia wywiad w przesłuchanie i ludzie odpadają w połowie.
Cały komplet dwudziestu dziewięciu pól naraz też odpada — nie da się tego
przeczytać.

**Powiedz, gdzie to się pokaże.** „To zdanie zobaczy ktoś, kto znajdzie sklep
w Google, zanim jeszcze wejdzie na stronę" działa lepiej niż „opis meta".
Właściciel podejmuje wtedy decyzję, a nie zgaduje, czego od niego chcesz.

**Ostrzegaj przy polach, które kosztują.** Przy obietnicach handlowych powiedz
wprost, że każde takie zdanie jest wiążące i że pusta lista jest prawidłową
odpowiedzią. Sklep, który nic nie obiecuje, jest bezpieczny; sklep, który obiecuje
i nie dowozi, płaci karę.

### 3. Zapisuj na bieżąco

Po każdym bloku zapisuj odpowiedzi, nie na końcu całej rozmowy — jeśli rozmowa
się urwie, właściciel nie będzie musiał zaczynać od zera.

Odpowiedzi trafiają w dwa miejsca, bo służą do czego innego:

| gdzie | co tam idzie | po co |
|---|---|---|
| `web/lib/dane-sklepu.ts` | wszystko, co widać na stronie | zasila sklep |
| `docs/dane-sprzedawcy.md` | dane firmy, warunki, decyzje o obietnicach | ślad dla regulaminu i audytu |

Szablon drugiego pliku jest w
[`.claude/skills/zgodnosc-sklepu/references/dane-sprzedawcy.md`](../zgodnosc-sklepu/references/dane-sprzedawcy.md).
Nie wymyślaj własnego układu — audyt zgodności czyta ten plik i szuka w nim
nieuzupełnionych znaczników.

Puste tablice (`OBIETNICE`, `PLATNOSCI`, `STATYSTYKI`) są prawidłową odpowiedzią
i ukrywają odpowiednie sekcje strony. Jeśli właściciel nie ma czym wypełnić —
wyczyść tablicę, nie zostawiaj placeholderów. Znacznik na produkcji wygląda jak
usterka, a pusta sekcja jak decyzja.

### 4. Sprawdź, co z tego wyszło

```bash
node .claude/skills/wypelnij-sklep/scripts/zbierz-pytania.mjs
```

```bash
npm run typecheck && node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs --etap sprzedaz
```

Pierwsze polecenie pokazuje, co jeszcze zostało. Drugie sprawdza, czy sklep
z wypełnionymi danymi domyka wymogi sprzedaży konsumenckiej — wypełnienie pól
zamyka część punktów audytu, ale nie wszystkie, bo niektóre wymagają zmian
w kodzie. Czym są te punkty, opisuje
[skill zgodności](../zgodnosc-sklepu/SKILL.md).

Jeśli zmieniałeś hasło główne albo obietnice, przelatują też testy końcowe —
`npm run test:e2e` — bo dwa z nich czytają te wartości z konfiguracji.

### 5. Powiedz, co dalej

Na koniec trzy krótkie listy: co zostało wypełnione, co zostało puste świadomie
(i dlaczego to bezpieczne), co dalej blokuje sprzedaż. Trzecia lista jest
najważniejsza — właściciel wychodzi z tej rozmowy z wrażeniem, że sklep jest
gotowy, i musi wiedzieć, jeśli nie jest.

## Czego nie robić

Nie generuj regulaminu ani polityki prywatności z tego, co usłyszysz w wywiadzie.
To osobna robota, opisana w skillu zgodności, i kończy się przeglądem u prawnika.
Tutaj zbierasz fakty, które taki dokument dopiero umożliwiają.

Nie podpowiadaj wartości „na razie", żeby strona wyglądała lepiej. Szablon jest
tak zbudowany, że niewypełnione pole widać — i to jest funkcja, nie usterka.
