---
name: wyglad-i-ux
description: Reguły wyglądu i użyteczności sklepu Nordo — hierarchia wizualna, typografia, odstępy i grupowanie, układ listy produktów, karty produktu, koszyka, wyszukiwarki i nawigacji. Reguły pochodzą z zewnętrznych źródeł (Baymard Institute, Nielsen Norman Group, Laws of UX), każda z linkiem i uzasadnieniem z badań. Użyj zawsze, gdy pada „wygląd", „układ", „layout", „hierarchia", „typografia", „odstępy", „karta produktu", „lista produktów", „filtry", „sortowanie", „koszyk", „wyszukiwarka", „makieta", „mockup", „przeprojektowanie", a także przy każdej pracy nad ekranami sklepu w web/app i komponentami w web/components.
---

# Wygląd i UX sklepu Nordo

Reguły z badań, nie z gustu. Każda ma źródło — bo „mnie się tak podoba" nie jest
argumentem, którym da się rozstrzygnąć spór o układ karty produktu.

Pełne wypisy ze źródeł: [references/zrodla.md](references/zrodla.md).

## Zanim ruszysz wygląd: co jest źródłem prawdy

W tym projekcie o wyglądzie decyduje projekt w Figmie („luksusowy sklep
e-commerce"), a kierunek sprzed obecnego opisuje katalog `system-wizualny/`.
Ten skill **nie zastępuje** żadnego z nich — mówi, jakich reguł użyteczności
trzymać się przy przekładaniu projektu na kod, i co zrobić, gdy projekt jest
niejednoznaczny.

Kolejność: projekt graficzny → ten skill → własny osąd. Gdy projekt łamie regułę
z badań, powiedz o tym wprost właścicielowi i podaj źródło. Nie poprawiaj
projektu po cichu.

## Hierarchia wizualna

Cztery narzędzia, w tej kolejności użyteczności
([NN/g](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)):

1. **Wielkość.** Największy element czytany pierwszy. Najwyżej **trzy** stopnie
   wielkości (mały, średni, duży) i najwyżej **dwa** elementy naprawdę duże na
   ekran. Trzeci duży element kasuje hierarchię, którą tamte dwa zbudowały.
2. **Kontrast i kolor.** Najwyżej **trzy** poziomy kontrastu. Jasne, nasycone
   barwy zarezerwowane dla rzeczy ważnych — jeśli świeci wszystko, nie świeci
   nic. Kolor nigdy jako jedyny nośnik informacji.
3. **Odstęp i bliskość.** Rzeczy powiązane bliżej siebie, rozdzielne dalej. To
   działa mocniej niż ramki. Ramki i tła dopiero wtedy, gdy sam odstęp nie
   wystarcza.
4. **Wyrównanie i powtórzenie.** Ta sama rzecz wygląda tak samo za każdym razem.

Zakresy wielkości podane przez NN/g dla stron: tekst **14–16 px**, podnagłówek
**18–22 px**, nagłówek **32 px i wyżej**.

**Test zmrużonych oczu.** Rozmyj ekran (5–20 px) i popatrz. Jeśli po rozmyciu
nie widać, co jest najważniejsze i co z czym idzie w parze — hierarchii nie ma,
choćby tekst był poprawny.

## Prawa, które warto mieć w głowie

Z [Laws of UX](https://lawsofux.com/):

- **Jakoba** — ludzie spędzają czas na innych sklepach i oczekują, że nasz
  zadziała tak samo. Koszyk w prawym górnym rogu nie jest brakiem wyobraźni,
  tylko trafieniem w nawyk.
- **Fittsa** — czas trafienia zależy od wielkości celu i odległości. Główny
  przycisk ma być duży i blisko wzroku, nie ładny i mały.
- **Hicka** — czas decyzji rośnie z liczbą opcji. Dwa przyciski o równej wadze
  obok siebie to opóźnienie, nie wybór.
- **Von Restorffa** — element odmienny zapada w pamięć. Dlatego wyróżniony jest
  jeden przycisk na ekran, nie cztery.
- **Pozycji szeregowej** — z listy najlepiej pamięta się początek i koniec.
  Najważniejsze pozycje menu na krańcach, nie w środku.
- **Estetyki i użyteczności** — ładniejszy interfejs bywa odbierany jako
  wygodniejszy. To działa na naszą korzyść, ale nie zastępuje wygody.

## Lista produktów i kategorie

Reguły z badań [Baymard Institute](https://baymard.com/learn/ecommerce-ux-best-practices)
(25 rund testów użyteczności, ponad 4400 sesji):

- **Liczba wyników nad listą i pod nią.** Bez tego nie da się ocenić, czy warto
  przeglądać dalej.
- **„Pokaż więcej" zamiast stronicowania** i zamiast nieskończonego przewijania.
  Pozwala porównywać pozycje z różnych partii bez skakania po stronach.
- **Ocena razem z liczbą opinii.** Sama liczba gwiazdek nic nie waży — ufa się
  jej dopiero, gdy widać, ilu ludzi ją wystawiło.
- **Rozróżnij wzrokowo części opisu** — nazwa, marka, typ, cechy. Krój, grubość,
  odstęp. Inaczej karta jest ścianą tekstu.
- **Filtr „promocje" osobno**, nie schowany w filtrze ceny.
- **Kwadraciki przy filtrach** — bez nich nie widać, że to w ogóle filtr.
- **Cztery sortowania**: cena, ocena, popularność, nowość. Domyślnie
  „trafność" — pokazuje przekrój oferty.
- **Kategorie dzielone przy ~10 pozycjach**, a na najgłębszym poziomie ma być
  co najmniej 10 produktów. Kategoria z trzema sztukami to ślepy zaułek.

## Karta produktu

Tu zapada decyzja o zakupie — Baymard nazywa ją środkiem ciężkości całego
sklepu. I tu jest najgorzej: **52% sklepów na komputerze i 62% na telefonie ma
kartę produktu ocenioną jako przeciętna albo gorszą**
([Baymard](https://baymard.com/blog/current-state-ecommerce-product-page-ux)).

- **Co najmniej 3–5 zdjęć** z różnych stron. Ludzie oceniają towar wzrokiem.
- **Wideo przy droższym albo złożonym towarze.**
- **Długie opisy w zwijanych sekcjach** — przegląd całości bez ściany tekstu.
- **Jeden wyróżniony przycisk „do koszyka".** Bez konkurencji obok. „Dodaj do
  ulubionych" ma być wyraźnie słabszy wizualnie.
- **Zwroty napisane po ludzku**, ze wskazaniem wprost, kto płaci za przesyłkę
  zwrotną.

## Nawigacja, wyszukiwarka, koszyk

- **Pole wyszukiwania widoczne** — wyraźna ramka, kontrast, większy tekst.
  Wyszukiwarka wtopiona w grafikę ginie.
- **Dokładne trafienie na pierwszym miejscu.** Kto wpisuje pełną nazwę, ma ją
  dostać na górze.
- **Synonimy i skróty** mapowane na typy produktów — ludzie szukają swoimi
  słowami, nie naszymi.
- **Koszyk w prawym górnym rogu**, kontrastowa ikona, licznik sztuk, odstęp
  dookoła.
- **Konto w prawym górnym rogu** — tam go ludzie szukają.
- **Karuzela na telefonie nie obraca się sama.** 52% sklepów nadal to robi,
  a badani „wound up going on unintended detours".
- **Czat nie otwiera się sam.** Statyczny odnośnik w nagłówku i stopce.
- **„FAQ" w stopce** pod tą nazwą.

## Konto klienta

- **Otwarte zamówienia na wierzchu** — po to ludzie tam wchodzą.
- **Kamienie milowe statusu** widoczne. Przejrzystość zmniejsza liczbę pytań do
  obsługi.
- **Jawny przycisk „Zapisz"** przy edycji danych, nieaktywny dopóki nic się nie
  zmieniło. Zapis „w locie" prowadzi do zmian przypadkiem.

## Czego ten skill nie rozstrzyga

**Kontrastu barw nie liczy się na oko.** W repozytorium jest do tego przyrząd:

```bash
npm run kontrast
```

Liczy z tokenów w `globals.css`, obie palety w obu motywach, chodzi w CI.

**Dostępności ruchu** pilnuje osobny skill —
[ruch-i-animacje](../ruch-i-animacje/SKILL.md).
