# Fakty do zebrania od właściciela

Zadaj to **jednym komunikatem**, pogrupowane tak jak niżej. Rozmowa rozbita na
dwadzieścia rund kończy się tym, że właściciel zgaduje albo rezygnuje — a zgadnięty
NIP w regulaminie jest gorszy niż jego brak.

Oznacz przy pytaniu, czy jest blokujące (**B**) — bez niego sklep nie może przyjmować
zamówień — czy da się z nim poczekać (**P**).

Odpowiedzi zapisz do `docs/dane-sprzedawcy.md` w układzie z sekcji „Szablon zapisu"
na końcu tego pliku. Wpisuj **dosłownie to, co powie właściciel**. Czego nie wie —
zostaw jako `⟨DO UZUPEŁNIENIA: opis⟩`; skrypt audytu traktuje taki wpis jako otwarty
punkt i nie pozwoli ogłosić gotowości.

---

## 1. Kto sprzedaje (B)

- Pełna nazwa firmy, dokładnie jak w rejestrze
- Adres siedziby, a jeśli inny — adres do korespondencji i do zwrotów
- NIP, REGON; przy spółce także KRS, sąd rejestrowy i kapitał zakładowy
- Forma działalności: jednoosobowa, spółka, działalność nierejestrowana

## 2. Kontakt (B)

- Adres e-mail obsługi klienta — ten, który ktoś faktycznie czyta
- Telefon i godziny pracy, albo wyraźna informacja, że kontakt jest tylko mailowy
- Adres do reklamacji i do zwrotów, jeśli inny niż siedziba

## 3. Dostawa (B)

- Z jakimi przewoźnikami jest podpisana umowa
- Cena każdej formy dostawy i realny termin doręczenia
- Próg darmowej dostawy — dziś w bazie stoi 300 zł
- Czy sklep wysyła za granicę; jeśli tak — dokąd, za ile, w jakim terminie
- Czy paczkomat ma zostać dowieziony jako druga forma dostawy, czy skreślony
  ze strony informacyjnej

## 4. Płatności (B)

- Które formy są faktycznie uruchomione u operatora
- Czy „raty 0%" mają pokrycie w umowie z dostawcą usługi — jeśli nie, zapis znika
- Termin płatności i co się dzieje z zamówieniem nieopłaconym

## 5. Zwroty i reklamacje (B)

- Ile dni na odstąpienie: 30 czy ustawowe 14. Trzydzieści pada dziś w czterech
  miejscach w kodzie — jeśli to ma zostać, musi być spójne wszędzie
- Kto płaci za odesłanie towaru przy odstąpieniu
- Czy gwarancja door-to-door istnieje naprawdę: kto jest gwarantem, na jak długo,
  na jakich warunkach. Jeśli nie ma umowy — zapis znika, zostaje sama
  odpowiedzialność ustawowa
- Termin rozpatrzenia reklamacji

## 6. Dane osobowe (B częściowo)

- Kto jest administratorem — zwykle firma z punktu 1 **(B)**
- Czy powołany jest inspektor ochrony danych; jeśli tak, dane kontaktowe **(P)**
- Czy podpisane są umowy powierzenia z: Supabase, Vercel, Stripe, Sentry **(B)** —
  to zadanie właściciela, kod tego nie załatwi
- Jak długo trzymane są dane po zamknięciu konta i po ostatnim zamówieniu **(P)** —
  przy braku odpowiedzi wpisz okresy wynikające z przepisów podatkowych
  i oznacz jako do potwierdzenia
- Czy sklep planuje newsletter; jeśli tak, przez jakie narzędzie **(P)**

## 7. Twierdzenia na stronie (B — decyzja, nie fakt)

Przejdź te zdania po kolei i przy każdym zapytaj: prawda czy do usunięcia?

- „Sklep z elektroniką od 2019 roku"
- „Ponad 120 000 zrealizowanych zamówień"
- „Średnia ocen 4,8"
- „Wysyłka w 24 h — zamówienia do 15:00 tego samego dnia"
- „2 lata gwarancji door-to-door — odbieramy i odsyłamy na nasz koszt"
- „Darmowa dostawa od 300 zł"
- „Raty 0%"

Nie ma opcji „zostawmy na razie". Każde z tych zdań jest albo prawdziwe, albo jest
praktyką wprowadzającą w błąd.

## 8. Katalog produkcyjny (B — decyzja)

- Czy sklep startuje z wyzerowanymi ocenami produktów, czy czeka na pierwsze
  prawdziwe opinie
- Dla każdego produktu w ofercie: nazwa i adres producenta, a przy producencie
  spoza UE — podmiot odpowiedzialny w Unii; ostrzeżenia i informacje
  o bezpieczeństwie (wymóg GPSR)

## 9. Tryb sprzedaży (P)

- Czy przełącznik `catalog` / `single` ma trafić do panelu admina, czy zostaje
  w zmiennej środowiskowej
- W trybie `single` — który produkt jest wyróżniony
- Czy w `single` reszta katalogu ma zostać dostępna pod bezpośrednim adresem,
  czy ma zniknąć całkowicie

---

## Szablon zapisu

Zapisz do `docs/dane-sprzedawcy.md`:

```markdown
# Dane sprzedawcy

Źródło prawdy dla regulaminu, polityki prywatności i stron informacyjnych.
Zmiana czegokolwiek tutaj wymaga przejrzenia tekstów, które z tego korzystają.

Ostatnia aktualizacja: RRRR-MM-DD

## Sprzedawca
- Nazwa:
- Adres siedziby:
- Adres do zwrotów:
- NIP:
- REGON:
- KRS / sąd rejestrowy:

## Kontakt
- E-mail obsługi:
- Telefon:
- Godziny pracy:

## Dostawa
| forma | przewoźnik | cena | termin |
|---|---|---|---|

- Próg darmowej dostawy:
- Wysyłka zagraniczna:

## Płatności
- Uruchomione formy:
- Raty 0% — umowa z:

## Zwroty i reklamacje
- Termin odstąpienia:
- Koszt odesłania pokrywa:
- Gwarancja — gwarant, okres, warunki:
- Termin rozpatrzenia reklamacji:

## Dane osobowe
- Administrator:
- Inspektor ochrony danych:
- Umowy powierzenia podpisane z:
- Okresy przechowywania:

## Twierdzenia na stronie
| zdanie | prawdziwe? | decyzja |
|---|---|---|

## Tryb sprzedaży
- Przełącznik w panelu / w środowisku:
- Wyróżniony produkt:
```

Puste pole zostawione bez `⟨DO UZUPEŁNIENIA: …⟩` to cichy błąd — audyt go
nie zauważy, a tekst prawny powstanie z niczego. Każde niewypełnione pole
oznaczaj jawnie.
