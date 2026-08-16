# Nordo na iPhone'a — dwie aplikacje z jednego celu

Natywna powłoka SwiftUI wokół stron serwisu. Sesja trzyma się w ciasteczkach
`WKWebView`, więc logowanie działa tak samo jak w Safari, a zmiana w sklepie
nie wymaga przebudowy aplikacji — wystarczy wdrożenie na Vercelu.

Ten sam kod daje dwa niezależne programy:

| | sklep | magazyn |
|---|---|---|
| identyfikator | `pl.nordo.sklep` | `pl.nordo.magazyn` |
| nazwa pod ikoną | Nordo | Nordo Magazyn |
| adres startowy | `/` | `/magazyn` |
| zakładki | brak — jeden ciąg stron | Przegląd · Zamówienia · Magazyn · Skaner |
| ikona | grafit, jasny monogram | sienna, biały monogram |
| tło obszarów bezpiecznych | `--bg` sklepu | `--tlo` z bloku `.mag` |

Rozróżnia je **wyłącznie** ustawienie `NORDO_WARIANT` (`sklep` albo
`magazyn`), czytane z `Info.plist` przez `Wariant.biezacy`. Od niego zależą
zakładki, paleta tła i barwa akcentu — reszta kodu jest wspólna.

Osobne pakiety oznaczają też osobne dane: dwie sesje, dwa komplety ciasteczek,
dwie zgody na aparat. Magazynier zalogowany w zapleczu nie wypycha właściciela
ze sklepu i odwrotnie.

## Budowanie i instalacja

Wymaga włączonego **trybu dewelopera** na telefonie:
Ustawienia → Prywatność i bezpieczeństwo → Tryb dewelopera → włącz → restart.
Identyfikator urządzenia: `xcrun devicectl list devices`.

```bash
./ios/zbuduj.sh obie <identyfikator-urządzenia>
```

`sklep` albo `magazyn` zamiast `obie` buduje jeden wariant. Bez identyfikatora
skrypt buduje, ale nie instaluje. Adres bazowy podmienia zmienna `NORDO_BAZA`.

Skrypt nadpisuje pięć ustawień z linii poleceń — `PRODUCT_BUNDLE_IDENTIFIER`,
`PRODUCT_NAME`, `NORDO_URL`, `NORDO_WARIANT` i
`ASSETCATALOG_COMPILER_APPICON_NAME`. Drugi cel w projekcie oznaczałby ręczną
edycję `project.pbxproj`, pliku generowanego przez Xcode, który przy błędzie
przestaje się otwierać.

Przycisk „Run" w Xcode buduje wariant domyślny, czyli **magazyn** — tak stoi
w ustawieniach projektu.

## Serwer deweloperski w sieci lokalnej

Wtedy każda zmiana w kodzie sklepu pojawia się w aplikacji po odświeżeniu, bez
wgrywania od nowa:

```bash
NORDO_BAZA="http://$(ipconfig getifaddr en0):3000" ./ios/zbuduj.sh magazyn <identyfikator-urządzenia>
```

Telefon musi być w tej samej sieci Wi-Fi. Zgoda na HTTP obejmuje wyłącznie
adresy prywatne (`NSAllowsLocalNetworking`) — produkcja idzie po HTTPS i z tej
furtki nie korzysta.

## Ikony

Rysuje je `narzedzia/ikona.swift` — monogram krojem systemowym na jednolitym
polu, bez przezroczystości i bez zaokrągleń, bo maskę rysuje iOS. Kolory idą
z palet obu aplikacji; sklep dostaje grafit, bo w jego palecie wyróżnia
kontrast, a nie barwa, magazyn siennę, bo to jego jedyna barwa i znak
rozpoznawczy.

```bash
swift ios/narzedzia/ikona.swift sklep   ios/NordoMagazyn/Assets.xcassets/AppIconSklep.appiconset/ikona-1024.png
swift ios/narzedzia/ikona.swift magazyn ios/NordoMagazyn/Assets.xcassets/AppIcon.appiconset/ikona-1024.png
```

## Podpisywanie

`DEVELOPMENT_TEAM` w `project.pbxproj` wskazuje na zespół powiązany
z Apple ID zalogowanym w Xcode. Przy koncie darmowym certyfikat wygasa po
siedmiu dniach i aplikację trzeba wgrać ponownie. Konto płatne (99 USD/rok)
przedłuża to do roku.
