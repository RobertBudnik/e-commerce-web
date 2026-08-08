---
name: zgodnosc-sklepu
description: Doprowadza sklep Nordo do zgodności ze sprzedażą konsumencką w PL/UE — zgoda na regulamin i klauzula RODO w koszyku, dane sprzedawcy, prawo odstąpienia, zgodność towaru z umową, Omnibus, GPSR, ujawnienie procesorów, spójność trybu catalog/single. Użyj zawsze, gdy pada „zgodność", „RODO", „regulamin", „polityka prywatności", „prawa konsumenta", „Omnibus", „GPSR", „audyt prawny", „czy mogę zacząć sprzedawać", „przed startem sklepu", a także przy każdej pracy nad koszykiem, stronami w web/app/informacje, trybem sprzedaży (NEXT_PUBLIC_STORE_MODE, store-mode.ts) i przy dodawaniu obietnic handlowych na stronie. Użyj też, gdy ktoś prosi o „naprawienie wszystkich błędów prawnych naraz".
---

# Zgodność sklepu Nordo

Sklep sprzedaje elektronikę konsumentom w Polsce. Ścieżka zakupowa jest
technicznie poprawna — przycisk mówi wprost `Zamawiam i płacę · {kwota}`,
podsumowanie z dostawą widać przed kliknięciem, opinie wystawiają wyłącznie
kupujący. Braki siedzą w warstwie informacyjnej i w niedokończonym trybie
`single`.

Ten skill zamyka wszystkie ustalenia audytu w jednym przebiegu. Pełny katalog —
co, gdzie, z czego wynika, jak naprawić — jest w
[references/ustalenia.md](references/ustalenia.md). Czytaj go, zanim ruszysz kod:
bez podstawy prawnej nie da się ocenić, czy zapis wolno usunąć, czy trzeba go
zastąpić.

## Reguła nadrzędna: nie zmyślaj faktów

Największe ryzyko przy takiej naprawie nie jest techniczne. To wygenerowanie
regulaminu i polityki prywatności, które **brzmią** wiarygodnie, a opisują sklep,
którego nie ma — inny adres, inny przewoźnik, nieistniejący inspektor ochrony
danych. Taki dokument jest gorszy niż jego brak, bo właściciel przestaje wiedzieć,
że czegoś mu brakuje, a przy kontroli odpowiada za treść, której nigdy nie czytał.
Kod sklepu ostrzega przed tym wprost w nagłówku `web/lib/strony-informacyjne.ts`.

Stąd podział, który obowiązuje w całym przebiegu:

| kategoria | co z tym robisz |
|---|---|
| **kod** — bramki, linki, kolumny, spójność trybu | naprawiasz sam, od razu |
| **fakty** — NIP, adres, przewoźnik, procesory, realna gwarancja | pytasz właściciela raz, zbiorczo, i wstawiasz dosłownie to, co powie |
| **decyzje** — obietnice handlowe bez pokrycia | pokazujesz wybór: usunąć zapis albo dowieźć funkcję; nie wybierasz za właściciela |

Czego nigdy nie robisz: nie wpisujesz przykładowego NIP-u „do czasu", nie
zostawiasz `Lorem ipsum` w regulaminie, nie usuwasz po cichu zdania o gwarancji,
żeby audyt przestał krzyczeć. Placeholder ma być widoczny i ma boleć —
`⟨DO UZUPEŁNIENIA: numer NIP⟩` przechodzi przez skrypt audytu jako otwarty punkt.

## Dwa etapy — ustal, gdzie jesteś, zanim zaczniesz

Sklep bez sprzedawcy i bez towaru niczego nie narusza. Obowiązki konsumenckie
wchodzą w chwili pierwszej sprzedaży konsumentowi, nie w chwili postawienia
strony. Ta różnica decyduje o całej kolejności pracy, więc rozstrzygnij ją
na wstępie — wystarczy pytanie, czy jest już firma i towar.

| etap | kiedy | co się liczy |
|---|---|---|
| **projekt** | nie ma jeszcze firmy, nazwy ani asortymentu | wyłącznie braki naprawialne z kodu; punkty zależne od tożsamości sprzedawcy czekają |
| **sprzedaz** | przed wpuszczeniem prawdziwego ruchu | wszystko |

Na etapie projektu nie pytaj o NIP i nie pisz regulaminu. Nie ma z czego —
a dokument napisany „na razie" zostanie na produkcji, bo nikt nie pamięta,
żeby wrócić do tekstu, który wygląda na gotowy. Zbuduj natomiast strukturę,
która przyjmie te dane jednym ruchem, gdy się pojawią.

## Przebieg

### 1. Zobacz, co jest otwarte

```bash
node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs
```

Domyślnie leci etap `projekt`. Przed startem sprzedaży przełącz na pełną listę:

```bash
node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs --etap sprzedaz
```

Skrypt sprawdza ustalenia po wzorcach w kodzie, nie po numerach linii, więc
przeżywa refaktor. Kończy się kodem 1, jeśli została blokada licząca się na
danym etapie. Uruchamiaj go na początku, po każdej większej partii zmian
i na końcu — to jedyny sposób, żeby wiedzieć, że naprawa jest pełna, a nie że
skończyły ci się pomysły.

Wagi znaczą tyle:

- **blokada** — przy tym stanie sklep nie może przyjmować zamówień od konsumentów
- **wysokie** — realne ryzyko kary albo roszczenia, do zamknięcia przed ruchem
- **średnie** — do zamknięcia, ale nie wstrzymuje startu
- **decyzja** — skrypt nie rozstrzygnie, potrzebna odpowiedź właściciela

Stan `odroczone` (znak `~`) znaczy: punkt jest otwarty, ale czeka na tożsamość
sprzedawcy i na tym etapie nie jest brakiem do naprawy.

### 2. Zbierz fakty — raz, zbiorczo

**Ten krok pomijasz na etapie projektu.** Wróć do niego, gdy będzie firma i towar.

Zanim napiszesz choć jedno zdanie do regulaminu, zadaj wszystkie pytania naraz.
Rozmowa rozbita na dwadzieścia rund jest dla właściciela nie do przejścia i
kończy się tym, że zgaduje albo rezygnuje.

Formularz pytań: [references/dane-sprzedawcy.md](references/dane-sprzedawcy.md).
Zadaj je jednym komunikatem, pogrupowane, z zaznaczeniem, które są blokujące.
Odpowiedzi zapisz do `docs/dane-sprzedawcy.md` — to źródło prawdy dla wszystkich
tekstów i punkt, do którego wracasz przy kolejnej zmianie regulaminu.

Jeśli właściciel czegoś nie wie (typowo: podstawa prawna przetwarzania po stronie
przewoźnika, okresy retencji), zostaw jawny placeholder i idź dalej. Zatrzymanie
całej naprawy na jednym nieznanym polu jest gorsze niż dowiezienie dwudziestu
trzech punktów i jednego otwartego.

### 3. Napraw kod

Kolejność ma znaczenie — blokady najpierw, bo to one decydują, czy sklep w ogóle
może ruszyć. Przepisy naprawy dla każdego ustalenia są w
[references/ustalenia.md](references/ustalenia.md).

Trzy rzeczy, o których łatwo zapomnieć przy tej konkretnej bazie kodu:

**Interfejs nie jest zabezpieczeniem.** Ukrycie bloku „do uzupełnienia" czy
przełącznika trybu w komponencie to UX, nie kontrola dostępu. Jeśli coś ma być
zastrzeżone dla zarządcy, granica idzie przez rolę z tokenu i politykę RLS,
tak jak w reszcie tego projektu.

**Zmiana treści prawnej to zmiana umowy.** Regulamin żyje dziś jako stała w kodzie.
Gdy przenosisz go albo tryb sprzedaży do bazy, dokładasz wersjonowanie i zapis
wersji w zamówieniu — inaczej po miesiącu nikt nie odtworzy, na co klient się
zgodził. To nie nadgorliwość, tylko art. 21 ustawy o prawach konsumenta:
przy sporze to sprzedawca wykazuje treść umowy.

**Tryb `single` to nie jest inny wygląd, tylko inna oferta.** Każda naprawa musi
działać w obu trybach. Po zmianie sprawdź jedno i drugie —
`NEXT_PUBLIC_STORE_MODE=single npm run dev` oraz `catalog`. Osobna sekcja
z pułapkami tego trybu jest w katalogu ustaleń.

### 4. Napisz teksty

Teksty budujesz **wyłącznie** z `docs/dane-sprzedawcy.md`. Struktura sekcji, których
wymaga prawo, jest w katalogu ustaleń przy odpowiednich punktach — regulamin,
polityka prywatności, odstąpienie, zgodność towaru z umową.

Ton dopasuj do reszty sklepu: krótkie zdania, bez prawniczej waty, bez „niniejszym".
Klient ma zrozumieć, co mu przysługuje, przy pierwszym czytaniu — to zresztą
wymóg, a nie uprzejmość: informacja ma być udzielona w sposób jasny i zrozumiały.

Zostaw na końcu każdego dokumentu datę wersji. Bez niej wersjonowanie z punktu 3
nie ma czego pokazać.

### 5. Zweryfikuj

Trzy rzeczy, wszystkie muszą przejść:

```bash
node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs
```

```bash
npm run typecheck && npm run db:test
```

```bash
npm run test:e2e
```

E2E potrafi paść na zajeżdżonej bazie, nie na twojej zmianie — przy losowych
porażkach najpierw `npm run db:reset`, potem dopiero szukaj regresji.

Jeśli dokładałeś kolumny albo tabele (historia cen, dane producenta, tryb
w zamówieniu), migracja idzie osobnym plikiem w `supabase/migrations/`, razem
z polityką RLS i grantami. `supabase db diff` nie pokazuje grantów funkcji —
uprawnienia sprawdzaj osobnym zapytaniem, inaczej na produkcji wyjdzie brak
dostępu, którego lokalnie nie widać.

### 6. Zdaj raport

Na koniec napisz właścicielowi trzy listy, w tej kolejności:

1. **Zamknięte** — co zostało naprawione, jednym zdaniem na punkt
2. **Czeka na Ciebie** — czego nie dało się domknąć bez jego faktu albo decyzji,
   z konkretnym pytaniem przy każdym
3. **Świadomie odłożone** — co zostaje otwarte i dlaczego to bezpieczne

Trzecia lista jest równie ważna jak pierwsza. Raport, który mówi „gotowe",
gdy dwa punkty czekają na NIP, jest wart tyle co brak raportu.

## Czego ten skill nie robi

Nie jest poradą prawną i nie udaje jej. Zamyka luki, które da się zamknąć
z kodu i z faktów podanych przez właściciela — ale gotowy komplet dokumentów
przed startem sprzedaży czyta radca prawny. Powiedz to wprost w raporcie,
raz, bez owijania; powtarzanie tego przy każdym punkcie tylko rozmywa treść.
