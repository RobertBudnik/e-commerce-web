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

`MagazynView.swift`, stała `adresMagazynu`. Do pracy nad kodem podmień na
adres z sieci lokalnej i dopisz zgodę na HTTP w `Info.plist`.
