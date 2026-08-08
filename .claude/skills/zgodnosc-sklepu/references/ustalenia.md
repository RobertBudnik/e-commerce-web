# Katalog ustaleń

Każdy punkt: co jest nie tak, z czego to wynika, jak to naprawić. Identyfikatory
zgadzają się z `scripts/audyt.mjs` — skrypt mówi, co jest otwarte, ten plik mówi,
co z tym zrobić.

Siedem punktów jest oznaczonych w skrypcie jako `etap: 'sprzedaz'` — bez nazwy
firmy, NIP-u i asortymentu nie da się ich domknąć, więc na etapie projektu
pokazują się jako `odroczone`: [dane-zebrane](#dane-zebrane),
[dane-na-stronie](#dane-na-stronie), [regulamin-tresc](#regulamin-tresc),
[klauzula-rodo](#klauzula-rodo), [dostawa-rozjazd](#dostawa-rozjazd),
[procesory-ujawnione](#procesory-ujawnione), [potwierdzenie-umowy](#potwierdzenie-umowy).
Reszta jest naprawialna z samego kodu, niezależnie od tego, kto ostatecznie
będzie sprzedawcą.

Skróty: **UPK** — ustawa o prawach konsumenta, **uśude** — ustawa o świadczeniu
usług drogą elektroniczną, **uPNPR** — ustawa o przeciwdziałaniu nieuczciwym
praktykom rynkowym, **PKE** — Prawo komunikacji elektronicznej.

## Spis

Blokady: [todo-publiczne](#todo-publiczne) · [zgoda-regulamin](#zgoda-regulamin) ·
[klauzula-rodo](#klauzula-rodo) · [pouczenie-odstapienie](#pouczenie-odstapienie) ·
[dane-zebrane](#dane-zebrane) · [dane-na-stronie](#dane-na-stronie) ·
[regulamin-tresc](#regulamin-tresc) · [tryb-martwy-kod](#tryb-martwy-kod)

Wysokie: [dostawa-rozjazd](#dostawa-rozjazd) · [usuniecie-konta](#usuniecie-konta) ·
[procesory-ujawnione](#procesory-ujawnione) · [zgodnosc-towaru](#zgodnosc-towaru) ·
[historia-cen](#historia-cen) · [gpsr](#gpsr) ·
[potwierdzenie-umowy](#potwierdzenie-umowy) · [tryb-linki-glowna](#tryb-linki-glowna) ·
[tryb-linki-stopka](#tryb-linki-stopka) · [tryb-podglad](#tryb-podglad) ·
[tryb-w-zamowieniu](#tryb-w-zamowieniu)

Średnie: [odr-nieaktualne](#odr-nieaktualne) · [newsletter-zgoda](#newsletter-zgoda) ·
[plasowanie](#plasowanie) · [tryb-sitemap](#tryb-sitemap) · [tryb-slad](#tryb-slad)

Decyzje: [twierdzenia-handlowe](#twierdzenia-handlowe) · [oceny-z-ziarna](#oceny-z-ziarna)

---

# Blokady

## todo-publiczne

`web/app/informacje/[temat]/page.tsx`

Blok „Do uzupełnienia przed startem sprzedaży" renderuje się bezwarunkowo —
komentarz w kodzie twierdzi, że widzi go tylko właściciel, ale to zwykły
`<aside>`. Klient czyta na stronie regulaminu, że sklep nie jest gotowy.

Naprawa: zbuduj bramkę na roli zarządcy z tokenu (`user_role`), tak jak reszta
projektu rozstrzyga uprawnienia. Wariant awaryjny — `process.env.NODE_ENV !== 'production'` —
jest dopuszczalny tylko jako krok przejściowy, bo gubi sens tych notatek: mają
przypominać właścicielowi na produkcji, a nie znikać właśnie tam.

Ten sam blok siedzi w `web/app/pomoc/page.tsx` — wpisany na sztywno, nie przez
`STRONY_INFO`. Popraw oba, inaczej audyt przejdzie, a notatka zostanie.

## zgoda-regulamin

`web/components/cart/CartPage.tsx`

Formularz zamówienia nie ma ani jednego odnośnika do regulaminu. Zamówienie idzie
do bazy bez śladu, że kupujący miał szansę poznać warunki.

Podstawa: art. 8 ust. 1 uśude — regulamin udostępniany **przed** zawarciem umowy,
w sposób umożliwiający pozyskanie i odtworzenie. Art. 12 ust. 1 UPK — obowiązki
informacyjne przed zawarciem umowy na odległość.

Naprawa: nad przyciskiem `Zamawiam i płacę` checkbox wymagany do wysłania,
z odnośnikami otwierającymi regulamin i politykę prywatności. Walidacja musi
siedzieć **także** w akcji serwerowej `checkoutAction` — atrybut `required`
to podpowiedź przeglądarki, a akcję da się zawołać bez formularza. Ten projekt
już tak robi z adresem (`KOD_POCZTOWY`), trzymaj się tego wzorca.

Zgodę zapisz przy zamówieniu razem z wersją regulaminu — patrz
[tryb-w-zamowieniu](#tryb-w-zamowieniu). Checkbox bez zapisu nie dowodzi niczego.

## klauzula-rodo

`web/components/cart/CartPage.tsx`

Zakup jako gość zbiera imię, nazwisko, adres, telefon i e-mail, nie pokazując
klauzuli informacyjnej. Konto ma politykę prywatności w stopce, gość nie ma nic.

Podstawa: art. 13 RODO — informację podaje się w momencie zbierania danych,
nie „gdzieś na stronie".

Naprawa: zwięzły akapit pod formularzem — kto jest administratorem, w jakim celu
i na jakiej podstawie (wykonanie umowy), komu dane trafiają, jak długo są trzymane,
jakie prawa przysługują, plus odnośnik do pełnej polityki. Dane bierzesz
z `docs/dane-sprzedawcy.md`, nie z głowy.

## pouczenie-odstapienie

`web/components/cart/CartPage.tsx`

Sklep obiecuje 30 dni na zwrot na stronach informacyjnych, ale w momencie zakupu
nie pada o tym słowo.

Podstawa: art. 12 ust. 1 pkt 9-11 UPK — pouczenie o prawie odstąpienia, terminie,
sposobie i kosztach zwrotu towaru przed zawarciem umowy.

Naprawa: jedno zdanie przy checkboxie zgody, z odnośnikiem do
`/informacje/odstapienie-od-umowy`. Pilnuj spójności terminu — 30 dni pada dziś
w czterech miejscach (`TrustBlock`, `Marquee` na stronie głównej, obie strony
informacyjne). Rozjazd między nimi to gotowe roszczenie, bo konsument trzyma się
korzystniejszego zapisu.

## dane-zebrane

`docs/dane-sprzedawcy.md`

Plik jeszcze nie istnieje albo ma nieuzupełnione pola. To źródło prawdy dla
wszystkich tekstów prawnych.

Naprawa: zadaj właścicielowi pytania z [dane-sprzedawcy.md](dane-sprzedawcy.md)
jednym komunikatem i zapisz odpowiedzi dosłownie. Pola, których nie zna, zostają
jako `⟨DO UZUPEŁNIENIA: …⟩` — skrypt audytu je wyłapie.

## dane-na-stronie

`web/components/layout/SiteFooter.tsx`, `web/lib/strony-informacyjne.ts`

Nigdzie w sklepie nie ma nazwy firmy, adresu, NIP-u, REGON-u ani kontaktu.
Stopka mówi tylko „© 2026 Nordo".

Podstawa: art. 12 ust. 1 pkt 2-3 UPK oraz art. 5 uśude — dane identyfikujące
przedsiębiorcę mają być dostępne w sposób stały i łatwy.

Naprawa: pełne dane w stopce (mogą być drobnym drukiem) **i** w regulaminie,
oraz adres e-mail i telefon obsługi na `/pomoc`. Audyt wymaga numeru NIP,
nie samego słowa „NIP" — sprawdza wzorzec dziesięciu cyfr.

## regulamin-tresc

`web/lib/strony-informacyjne.ts`

Regulamin ma jedną sekcję i dwa zdania. To nie jest dokument, tylko zapowiedź
dokumentu.

Naprawa: minimum sekcji, które muszą się znaleźć — audyt liczy je i wymaga co
najmniej sześciu:

| sekcja | co zawiera |
|---|---|
| Sprzedawca | pełne dane z `docs/dane-sprzedawcy.md`, kontakt |
| Zawarcie umowy | moment zawarcia, potwierdzenie, wymagania techniczne |
| Ceny i płatność | ceny brutto z podatkiem, formy płatności, termin |
| Dostawa | formy, koszty, terminy, obszar wysyłki |
| Odstąpienie | 30 dni, sposób, koszty odesłania, wzór oświadczenia |
| Zgodność towaru z umową | reżim ustawowy — patrz [zgodnosc-towaru](#zgodnosc-towaru) |
| Reklamacje | tryb, termin rozpatrzenia, pozasądowe rozwiązywanie sporów |
| Dane osobowe | odesłanie do polityki, administrator |
| Zmiany regulaminu | tryb zmiany, wersjonowanie, prawa umów w toku |

Trzymaj język krótki. Wymóg jasnej i zrozumiałej informacji jest w art. 12 UPK —
prawniczy żargon nie jest bezpieczniejszy, tylko trudniejszy do obrony.

## tryb-martwy-kod

`web/lib/store-mode.ts`

`wyroznionyProdukt()` jest wyeksportowana i nikt jej nie woła. W efekcie tryb
`single` nie jest jednoproduktowy: strona główna nadal renderuje kategorie
i cały katalog, a znika tylko odnośnik „Sklep" w nagłówku.

To blokada, a nie usterka kosmetyczna — sklep, który deklaruje jedną ofertę,
a pokazuje kilkadziesiąt, wprowadza w błąd co do zakresu oferty (art. 5 uPNPR).

Naprawa: strona główna musi rozgałęziać się po trybie. W `single` pokazuje
wyłącznie wyróżniony produkt (albo pierwszy z katalogu, gdy zmienna pusta),
bez kategorii i bez siatki. Przy okazji domknij
[tryb-linki-glowna](#tryb-linki-glowna) — to ta sama zmiana.

---

# Wysokie

## dostawa-rozjazd

`web/lib/strony-informacyjne.ts`, `web/components/cart/CartPage.tsx`

Strona informacyjna reklamuje paczkomat za 14,99 zł. Koszyk nie ma wyboru
dostawy, a baza nalicza jedną stawkę `shipping_flat_cents` (domyślnie 1999).
Klient płaci pięć złotych więcej, niż mu obiecano.

Podstawa: art. 12 ust. 1 pkt 5 UPK, art. 5 uPNPR.

Naprawa — dwie drogi, wybiera właściciel:

1. **Dowieźć funkcję**: wybór formy dostawy w koszyku, druga stawka
   w `store_settings`, przekazanie wybranej formy do `create_order()`. Cena musi
   dalej pochodzić z bazy — przeglądarka przysyła identyfikator formy, nie kwotę.
2. **Usunąć obietnicę**: skreślić paczkomat ze strony informacyjnej.

Nie wybieraj sam. Pierwsza droga to dzień pracy, druga to jedna linia — to nie
jest decyzja techniczna.

## usuniecie-konta

`web/lib/strony-informacyjne.ts`

Polityka prywatności obiecuje: „Możesz w każdej chwili usunąć konto". W kodzie
nie ma żadnej ścieżki usunięcia.

Podstawa: art. 17 RODO. Obietnica bez pokrycia jest dodatkowo praktyką
wprowadzającą w błąd.

Naprawa: funkcja w bazie kasująca konto i dane profilowe, z zachowaniem tego,
co muszą przetrwać ze względów podatkowych (zamówienia, faktury). Anonimizacja
zamówienia zamiast kasowania — `user_id` na `null`, dane odbiorcy wyczyszczone.
Przycisk w `/konto`, potwierdzenie w dwóch krokach, ślad w zdarzeniach sklepu.

Jeśli właściciel nie chce tego teraz budować, jedyna uczciwa alternatywa to zmiana
zapisu na „konto usuwamy na żądanie wysłane na adres…" i realna obsługa tego
adresu. Zapis musi opisywać to, co się faktycznie dzieje.

## procesory-ujawnione

`web/lib/strony-informacyjne.ts`

Polityka nie wymienia żadnego odbiorcy danych. Sklep korzysta co najmniej
z Supabase (baza, uwierzytelnianie), Vercela (hosting), Stripe'a (płatności)
i Sentry (monitoring błędów).

Sentry zasługuje na osobną uwagę: `web/next.config.ts` ustawia
`tunnelRoute: '/monitoring'`, czyli zgłoszenia idą przez własną domenę, żeby
ominąć blokady reklam. Intencja jest techniczna, ale efekt jest taki, że
przeglądarka wysyła dane do procesora w sposób, którego użytkownik nie zobaczy
w narzędziach blokujących. Tym bardziej musi to być napisane wprost.

Podstawa: art. 13 ust. 1 lit. e RODO. Osobno: z każdym procesorem potrzebna
jest umowa powierzenia (art. 28) — to zadanie właściciela, nie kodu.

Naprawa: sekcja „Komu przekazujemy dane" z listą, celem i informacją o transferze
poza EOG tam, gdzie zachodzi.

## zgodnosc-towaru

`web/lib/strony-informacyjne.ts`

Strona zwrotów opisuje wyłącznie dobrowolną gwarancję door-to-door. Ustawowa
odpowiedzialność sprzedawcy za zgodność towaru z umową (rozdział 5a UPK) nie
pada w ogóle.

To poważniejsze, niż wygląda: konsument czytający tę stronę wnioskuje, że jego
uprawnienia zależą od gwarancji producenta. Gwarancja jest dobrowolna i może
zostać wycofana; odpowiedzialność ustawowa nie.

Naprawa: osobna sekcja opisująca reżim ustawowy — dwa lata, kolejność środków
(naprawa albo wymiana, potem obniżenie ceny albo odstąpienie), domniemanie
niezgodności w pierwszym roku, brak kosztów po stronie konsumenta. Gwarancja
zostaje obok, wyraźnie oznaczona jako dodatek, nie zamiennik.

## historia-cen

`supabase/migrations/`

`products.old_price_cents` to dowolne pole, a strona produktu liczy z niego
`−X%`. Nie ma z czego wyliczyć najniższej ceny z trzydziestu dni.

Podstawa: art. 4 ust. 2 ustawy o informowaniu o cenach (wdrożenie dyrektywy
Omnibus) — przy każdej obniżce podaje się najniższą cenę z 30 dni przed obniżką.

Naprawa: tabela historii cen (`product_id`, `price_cents`, `obowiazuje_od`),
wypełniana wyzwalaczem przy zmianie ceny produktu, plus funkcja licząca minimum
z okna 30 dni. Strona produktu pokazuje tę wartość obok ceny promocyjnej.
Migracja idzie osobnym plikiem, z polityką RLS i grantami — odczyt dla `anon`,
zapis wyłącznie przez wyzwalacz.

Uwaga na start: dla produktów bez historii nie wolno pokazywać przekreślonej ceny.
Brak danych to brak promocji, nie promocja liczona z pustego miejsca.

## gpsr

`supabase/migrations/`

Tabela `products` nie ma pól na producenta, importera ani ostrzeżenia. Panel
admina zbiera EAN, i tyle.

Podstawa: rozporządzenie 2023/988 (GPSR), obowiązuje od 13 grudnia 2024.
Elektronika jest w zakresie. Oferta w sklepie internetowym musi pokazywać nazwę
i adres producenta, a dla producenta spoza UE — podmiot odpowiedzialny w Unii,
plus ostrzeżenia i informacje o bezpieczeństwie.

Naprawa: kolumny na dane producenta i podmiotu odpowiedzialnego, pole na
ostrzeżenia, wyświetlenie ich na karcie produktu przy specyfikacji. Pola
w panelu admina obowiązkowe dla nowych produktów.

## potwierdzenie-umowy

`web/app/zamowienie/[numer]/page.tsx`

Strona po zamówieniu mówi „potwierdzenie idzie na e-mail". Żaden e-mail nie
wychodzi — w repozytorium nie ma nadawcy poczty.

Dwa problemy naraz: nieprawdziwa informacja dla klienta i brak potwierdzenia
umowy na trwałym nośniku (art. 21 UPK). Trwały nośnik to warunek, przy którym
w ogóle da się później wykazać treść umowy.

Naprawa: wysyłka potwierdzenia po `mark_order_paid()` — podsumowanie zamówienia,
regulamin w wersji obowiązującej przy zakupie, pouczenie o odstąpieniu i wzór
oświadczenia. Do czasu wdrożenia zmień zdanie na stronie, żeby nie obiecywało
czegoś, czego nie ma.

## tryb-linki-glowna

`web/app/page.tsx`

„Przeglądaj sklep", „Zobacz bestsellery", „Zobacz wszystko" i kafle kategorii
prowadzą do `/sklep`, a `/sklep` w trybie `single` odbija na `/`. Klient klika
i wraca tam, gdzie był.

Naprawa: rozgałęzienie po `storeMode()`. W `single` te sekcje albo znikają, albo
prowadzą do wyróżnionego produktu. Domknij razem z [tryb-martwy-kod](#tryb-martwy-kod).

## tryb-linki-stopka

`web/components/layout/SiteFooter.tsx`

Cztery odnośniki w kolumnie „Sklep" prowadzą do `/sklep` i do kategorii.
W trybie `single` wszystkie odbijają na stronę główną.

Naprawa: kolumna zależna od trybu. Nagłówek robi to już poprawnie
(`SiteHeader.tsx`) — powtórz ten wzorzec, nie wymyślaj drugiego.

## tryb-podglad

`web/lib/store-mode.ts`

`?mode=single` w adresie nadpisuje tryb dla każdego. Dziś skutki są kosmetyczne.
Gdy tryb zacznie sterować ofertą — a to jest cel zmiany — klient będzie mógł
sobie wyświetlić wersję sklepu inną niż obowiązująca.

Naprawa: nadpisanie działa wyłącznie dla zalogowanego zarządcy, rozstrzygane po
roli z tokenu. Dla pozostałych parametr jest ignorowany, bez komunikatu.

## tryb-w-zamowieniu

`supabase/migrations/`

`orders` nie zapisuje, w jakim trybie powstało zamówienie ani na jaką wersję
regulaminu zgodził się kupujący.

Dziś tryb zmienia się przez zmienną środowiskową, więc jest commit i data.
Po przeniesieniu przełącznika do panelu admin zmieni zakres oferty jednym
kliknięciem, natychmiast i bez śladu.

Podstawa: art. 21 UPK — przy sporze to sprzedawca wykazuje treść umowy.

Naprawa: kolumny `tryb_sprzedazy` i `wersja_regulaminu` w `orders`, wypełniane
przez `create_order()`, oraz tabela wersji regulaminu z datą obowiązywania.
Wersję czyta się w chwili składania zamówienia, nie renderowania koszyka —
inaczej długo otwarta karta zapisze nieaktualny numer.

---

# Średnie

## odr-nieaktualne

`web/lib/strony-informacyjne.ts`

Notatka odsyła do platformy ODR. Platforma została wygaszona 20 lipca 2025 —
odesłanie prowadzi donikąd.

Naprawa: informacja o pozasądowym rozwiązywaniu sporów przez wojewódzkie
inspektoraty Inspekcji Handlowej i miejskich lub powiatowych rzeczników
konsumentów. Ten obowiązek nie zniknął razem z platformą (art. 12 ust. 1 pkt 21 UPK).

## newsletter-zgoda

`web/app/page.tsx`

Formularz newslettera nie ma `action`, checkboxa zgody ani odnośnika do polityki.
Dziś nic nie robi, więc nic nie narusza — ale w tym stanie nie wolno go podłączyć.

Podstawa: art. 398 PKE — zgoda na marketing bezpośredni musi być uprzednia
i odrębna.

Naprawa: checkbox zgody (niezaznaczony domyślnie), odnośnik do polityki,
potwierdzenie zapisu w drugim kroku, mechanizm wypisania w każdej wiadomości.
Do czasu wdrożenia — usuń formularz albo oznacz jako nieaktywny; formularz,
który przyjmuje adres i go gubi, jest gorszy od jego braku.

## plasowanie

`web/app/sklep/page.tsx`

Lista i sortowanie po ocenie układają ofertę, nie mówiąc, według czego.
Dotyczy wyłącznie trybu `catalog`.

Podstawa: art. 12 ust. 1 pkt 21 UPK — główne parametry decydujące o kolejności.

Naprawa: krótka nota przy sortowaniu, np. rozwijana „Jak układamy wyniki".
Wystarczy zdanie, jeśli jest prawdziwe — kolejność wynika z oceny i dostępności,
a nie z opłat od dostawców.

## tryb-sitemap

`web/app/sitemap.ts`

Mapa strony zgłasza `/sklep` i wszystkie produkty niezależnie od trybu.
W `single` wyszukiwarka zaindeksuje ofertę, której landing nie sprzedaje.

Naprawa: budowa mapy po `storeModeZeSrodowiska()`. W `single` zostaje strona
główna, wyróżniony produkt i strony informacyjne.

## tryb-slad

`supabase/migrations/`

Jest już tabela zdarzeń sklepu. Przełączenie trybu nie zostawia w niej nic.

Naprawa: zdarzenie przy zmianie trybu — kto, kiedy, z czego na co. Przy zmianie
oferty jednym kliknięciem to jedyny sposób odtworzenia, co obowiązywało danego dnia.

---

# Decyzje właściciela

Tych dwóch skrypt nie rozstrzygnie. Pokaż wybór, nie wybieraj sam.

## twierdzenia-handlowe

`SiteFooter.tsx`, `page.tsx`, `TrustBlock.tsx`

Sklep twierdzi: działa od 2019 roku, ponad 120 000 zamówień, średnia ocen 4,8,
wysyłka w 24 h, dwa lata gwarancji door-to-door, raty 0%.

Każde z tych zdań jest albo prawdziwe, albo jest praktyką wprowadzającą w błąd
(art. 5 uPNPR). Nie ma trzeciej możliwości i nie ma znaczenia, że pochodzą
z szablonu.

Zapytaj wprost, punkt po punkcie: które są prawdziwe? Prawdziwe zostają.
Nieprawdziwe znikają albo zostają zastąpione tym, co właściciel faktycznie
dowozi. „Raty 0%" i „door-to-door" wymagają dodatkowo umowy z dostawcą usługi —
sama chęć nie wystarczy.

## oceny-z-ziarna

`scripts/seed-data.mjs`, `products.rating`, `products.reviews_count`

Katalog demonstracyjny wpisuje oceny i liczby opinii. Karta produktu i strona
produktu pokazują je tak samo jak prawdziwe — „4,7 · 128 opinii".

Tabela `reviews` jest zrobiona dobrze: opinię wystawia wyłącznie kupujący, a
wyzwalacz przelicza średnią. Problem dotyczy wyłącznie wartości z ziarna, które
zostaną w bazie produkcyjnej, jeśli nikt ich nie wyzeruje.

Podstawa: art. 7 pkt 23b uPNPR — prezentowanie opinii, które nie pochodzą od
konsumentów faktycznie korzystających z produktu, jest na czarnej liście.
Czarna lista znaczy tyle, że nie bada się, czy ktoś został wprowadzony w błąd.

Decyzja właściciela dotyczy tylko tego, czy katalog produkcyjny startuje
z wyzerowanymi ocenami (uczciwe, wygląda pusto), czy sklep rusza dopiero po
zebraniu pierwszych prawdziwych opinii. Trzeciej drogi nie ma.
