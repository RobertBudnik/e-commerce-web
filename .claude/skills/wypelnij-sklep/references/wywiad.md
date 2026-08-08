# Bloki wywiadu

Kolejność jest ułożona pod głowę właściciela, nie pod układ pliku
`dane-sklepu.ts`. Zaczyna od rzeczy, które ma gotowe — co sprzedaje i komu —
a papiery zostawia na później, kiedy rozmowa już się rozkręciła.

Każdy blok: co zapytać, czego posłuchać, co dopisać od siebie.

## Spis

1. [Rozgrzewka](#1-rozgrzewka) — bez zapisu, ustala ton całej reszty
2. [Marka](#2-marka) — nazwa, hasła, opisy
3. [Warunki sprzedaży](#3-warunki-sprzedazy) — terminy i liczby
4. [Obietnice](#4-obietnice) — co wolno napisać na stronie
5. [Firma](#5-firma) — dane rejestrowe i kontakt
6. [Decyzje odłożone](#6-decyzje-odlozone) — co zostaje puste i dlaczego

---

## 1. Rozgrzewka

Bez zapisu do plików. Dwa pytania, z których weźmiesz materiał na cały blok marki:

- Co sprzedajesz i komu? Jedna–dwie kategorie, kto to kupuje.
- Czym się różnisz od sklepu obok? Cena, wybór, doradztwo, szybkość, nisza.

Posłuchaj, jakich słów właściciel używa sam. Jeśli mówi „sprzęt", nie pisz
„produkty". Jeśli mówi „ludzie", nie pisz „klienci". Hasła napisane jego językiem
brzmią jak jego sklep, a nie jak szablon — i to jest cała robota w tym bloku.

Jeśli odpowiedzi są mgliste („no, różne rzeczy"), nie drąż w nieskończoność.
Przejdź do marki i wróć do tego przy konkretnym polu — łatwiej odpowiedzieć na
„jak nazwać sekcję, w której tłumaczysz, czemu warto u ciebie" niż na „czym się
różnisz".

## 2. Marka

Pola: `MARKA.nazwa`, `opisStopki`, `nadtytulHero`, `hasloHero`, `podtytulHero`,
`spotlightNadtytul`, `spotlightTekst`, `tytulKarty`, `opisMeta`.

Zapytaj o nazwę i hasło główne. Resztę **zaproponuj** na podstawie rozgrzewki,
pokazując gotowy komplet do poprawienia. Wypełnianie dziewięciu pól tekstowych
przez odpowiadanie na dziewięć pytań jest wyczerpujące, a większość z nich to
warianty tej samej myśli.

Przy proponowaniu:

- **Dwie–trzy wersje o różnym charakterze**, nie pięć wariantów tej samej.
  Np. jedna rzeczowa, jedna z charakterem, jedna krótka.
- **Krótkie uzasadnienie przy każdej**, jedno zdanie. Właściciel wybiera świadomie,
  a nie zgaduje, o co ci chodziło.
- **Hasło główne do ośmiu słów** — animacja rozsypuje litery i dłuższe się rozłazi.
- **`opisMeta` bez obietnic**, których nie ma w `OBIETNICE`. To ta sama informacja
  handlowa, tylko czytana w wynikach wyszukiwania. Rozjazd między nimi to
  dokładnie ten rodzaj drobiazgu, który wychodzi przy kontroli.

Jeśli właściciel nie ma nazwy, powiedz wprost, że resztę można wypełnić bez niej
i wrócić — nazwa siedzi w jednym polu i podmienia się przez cały sklep.
Nie blokuj na tym całego wywiadu.

## 3. Warunki sprzedaży

Pola: `WARUNKI.dniNaOdstapienie`, `gwarancja`, `progDarmowejDostawy`,
`rabatNewsletter`, oraz `DOSTAWA` i `PLATNOSCI`.

To już fakty — pytaj, nie proponuj.

- **Ile dni na zwrot?** Ustawowe minimum to 14. Więcej wolno i bywa argumentem
  sprzedażowym, ale dłuższy termin obowiązuje tak samo jak ustawowy. Powiedz to,
  zanim padnie odpowiedź „no dajmy 30, ładnie wygląda".
- **Z jakim przewoźnikiem masz umowę, ile kosztuje, ile trwa?** Cena musi zgadzać
  się ze stawką w tabeli `store_settings` — rozjazd między stroną a rachunkiem
  jest praktyką wprowadzającą w błąd. Jeśli umowy nie ma, `DOSTAWA` zostaje pusta.
- **Próg darmowej dostawy** — jeśli nie ma, zero.
- **Gwarancja** — dobrowolna. Dopytaj, kto jest gwarantem i na jakich warunkach.
  Przy odpowiedzi „no, standardowo dwa lata" wyjaśnij, że dwa lata to
  odpowiedzialność ustawowa za zgodność towaru z umową, która obowiązuje bez
  żadnej gwarancji, i że wpisanie jej tutaj niczego nie dodaje. Pusto to
  prawidłowa odpowiedź.
- **Formy płatności** — wyłącznie uruchomione u operatora. „Raty 0%" wymagają
  osobnej umowy; bez niej nie wchodzą.

## 4. Obietnice

Pola: `OBIETNICE`, `JAK_TO_DZIALA`, `STATYSTYKI`.

Najbardziej kosztowny blok i najłatwiejszy do wypełnienia bezmyślnie, bo brzmi
jak copywriting. Zacznij od ostrzeżenia, jednym zdaniem: każde z tych zdań jest
wobec kupującego wiążące, a pusta lista jest prawidłową odpowiedzią.

- **`OBIETNICE`** — trzy hasła na pasku i w kaflach. Buduj je z odpowiedzi
  z bloku 3, nie z powietrza: jeśli właściciel podał termin wysyłki, to jest
  obietnica; jeśli nie podał, nie wymyślaj jej.
- **`JAK_TO_DZIALA`** — trzy kroki procesu. Jeśli pada godzina graniczna
  („zamówienia do 15:00"), dopytaj, czy jest dotrzymywana także w piątek
  i przed świętami. To pytanie zwykle zmienia odpowiedź.
- **`STATYSTYKI`** — liczba zamówień, średnia ocen, czas wysyłki. Nowy sklep
  nie ma tu czego wpisać i tablica zostaje pusta. Liczby z szablonu („120 000
  zamówień") są nieprawdziwe, a nie ozdobne. Wróć do tego po pierwszym prawdziwym
  pomiarze.

## 5. Firma

Pola: `SPRZEDAWCA.nazwa`, `adres`, `nip`, `regon`, `krs`, `email`, `telefon`,
`godziny`, `adresZwrotow`.

Czyste przepisywanie. Zero propozycji, zero uzupełniania „logicznych" braków.

- Nazwa **dokładnie jak w rejestrze**, ze wszystkimi skrótami formy prawnej.
- Adres siedziby; osobno adres do zwrotów, jeśli inny.
- NIP i REGON; przy spółce także KRS i sąd rejestrowy.
- E-mail obsługi — ten, który ktoś faktycznie czyta.
- Telefon i godziny; jeśli kontakt jest wyłącznie mailowy, napisz to wprost
  zamiast zostawiać puste pole.

Te dane muszą być dostępne w sklepie w sposób stały i łatwy, dlatego trafiają
do stopki i do regulaminu. Jeśli właściciel dopiero zakłada działalność
i nie ma jeszcze numerów — zostaw znaczniki i zanotuj to w bloku 6. Sklep
z pustym NIP-em nie może przyjmować zamówień od konsumentów, i lepiej, żeby
usłyszał to teraz niż po pierwszej skardze.

## 6. Decyzje odłożone

Nie pole w konfiguracji, tylko zamknięcie rozmowy.

Wypisz, co zostało puste i **czy to bezpieczne**. Rozróżnienie jest istotne:

| pusty | skutek |
|---|---|
| `OBIETNICE`, `STATYSTYKI`, `PLATNOSCI` | sekcja znika, sklep działa, nic nie grozi |
| `WARUNKI.gwarancja` | brak gwarancji, odpowiedzialność ustawowa zostaje |
| `SPRZEDAWCA.*` | **sklep nie może sprzedawać konsumentom** |
| `MARKA.*` | znaczniki widoczne na stronie, wygląda jak usterka |

Potem odeślij do audytu zgodności po pełny obraz tego, co jeszcze dzieli sklep
od pierwszej sprzedaży — wypełnienie pól zamyka część punktów, ale nie te,
które wymagają zmian w kodzie.
