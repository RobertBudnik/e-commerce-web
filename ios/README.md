# Nordo — aplikacja magazynowa na iPhone'a

Natywna powłoka SwiftUI wokół widoku `/magazyn`. Sesja trzyma się
w ciasteczkach `WKWebView`, więc logowanie działa tak samo jak w Safari,
a aktualizacja magazynu nie wymaga przebudowy aplikacji — wystarczy wdrożenie
sklepu na Vercelu.

## Budowanie i instalacja przez kabel

Wymaga włączonego **trybu dewelopera** na telefonie:
Ustawienia → Prywatność i bezpieczeństwo → Tryb dewelopera → włącz → restart.

```bash
cd ios
xcodebuild -project NordoMagazyn.xcodeproj -scheme NordoMagazyn \
  -destination 'id=<identyfikator-urządzenia>' \
  -derivedDataPath build -allowProvisioningUpdates build
```

Identyfikator urządzenia: `xcrun devicectl list devices`.

Instalacja zbudowanej paczki:

```bash
xcrun devicectl device install app \
  --device <identyfikator-urządzenia> \
  build/Build/Products/Debug-iphoneos/NordoMagazyn.app
```

## Podpisywanie

`DEVELOPMENT_TEAM` w `project.pbxproj` wskazuje na zespół powiązany
z Apple ID zalogowanym w Xcode. Przy koncie darmowym certyfikat wygasa po
siedmiu dniach i aplikację trzeba wgrać ponownie. Konto płatne (99 USD/rok)
przedłuża to do roku.

## Adres

Ustawienie projektu `NORDO_URL`, czytane przez `Info.plist` i stałą
`adresMagazynu`. Domyślnie produkcja.

Build pod serwer deweloperski w sieci lokalnej — wtedy każda zmiana w kodzie
sklepu pojawia się w aplikacji po odświeżeniu, bez wgrywania od nowa:

```bash
xcodebuild -project NordoMagazyn.xcodeproj -scheme NordoMagazyn \
  -destination 'id=<identyfikator-urządzenia>' -derivedDataPath build \
  -allowProvisioningUpdates NORDO_URL="http://<ip-maca>:3000/magazyn" build
```

Adres Maca: `ipconfig getifaddr en0`. Telefon musi być w tej samej sieci Wi-Fi.
Zgoda na HTTP obejmuje wyłącznie adresy prywatne (`NSAllowsLocalNetworking`) —
produkcja idzie po HTTPS i z tej furtki nie korzysta.
