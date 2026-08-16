# iOS — lista kontrolna

Stan na sierpień 2026. Xcode 26, SDK iOS 26.5. Aplikacja `NordoMagazyn`:
powłoka SwiftUI z `WKWebView` wokół `/magazyn`, cel wdrożenia iOS 17.0,
tylko iPhone.

## Zanim w ogóle myślimy o App Store

Wytyczna **4.2 (Minimum Functionality)** odrzuca aplikacje, które są
przepakowaną stroną. Reviewerzy patrzą na trzy rzeczy:

1. Czy nawigacja jest natywna, czy to hamburger z DOM-u.
2. Czy aplikacja używa czegoś, czego strona nie może.
3. Czy logowanie jest trwałe, a pasek ładowania nie wygląda jak Safari.

Nordo ma **natywny pasek zakładek** (SwiftUI `TabView`, 4 zakładki — mieści się
w zalecanym przedziale 2–5), własny ekran braku sieci i odświeżanie gestem.
To więcej niż typowy „leniwy wrapper", ale wciąż mało jak na publiczny sklep
z aplikacjami.

**Rekomendacja: nie celować w publiczny App Store.** To narzędzie dla własnego
magazynu, więc właściwa droga to Apple Business Manager (aplikacja własna,
dystrybucja wewnętrzna) albo dalsze wgrywanie kablem. Publiczny review to
proszenie się o odmowę z 4.2 przy zerowym zysku.

Źródło: [App Store Review Guidelines 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality).

## Jeśli mimo to idziemy na App Store

- [ ] **`PrivacyInfo.xcprivacy`** — od 1 maja 2024 obowiązkowy. Plist z czterema
      kluczami: `NSPrivacyTracking`, `NSPrivacyTrackingDomains`,
      `NSPrivacyCollectedDataTypes`, `NSPrivacyAccessedAPITypes`.
      Nordo nie śledzi i nie zbiera danych po stronie natywnej, więc manifest
      będzie krótki — ale bez niego wysyłka paczki jest odrzucana.
- [ ] **Konfiguracja `Release`** — w `project.pbxproj` są dziś dwie `Debug`
      i żadnej `Release`. Bez niej nie ma jak zrobić archiwum.
- [ ] **Ikona aplikacji** — `ASSETCATALOG_COMPILER_APPICON_NAME` jest puste,
      nie ma katalogu zasobów.
- [ ] `MARKETING_VERSION` i `CURRENT_PROJECT_VERSION` podnoszone przy wydaniu.
- [ ] `NSAllowsLocalNetworking` wyłączone w konfiguracji produkcyjnej. Dziś
      jedyny config obsługuje i dev, i produkcję.
- [ ] ATT (`AppTrackingTransparency`) — **nie dotyczy**, aplikacja nie śledzi.
      Nie dodawać na zapas: pytanie bez powodu obniża zgody i budzi pytania
      w review.

Źródło: [Apple — privacy manifest](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files),
[ogłoszenie o terminie](https://developer.apple.com/news/?id=pvszzano).

## WKWebView

- [x] `applicationNameForUserAgent` przez publiczne API, nie KVC — KVC potrafi
      zwrócić pusto i wtedy serwer nie rozpoznaje powłoki.
- [x] `uiDelegate` ustawiony — bez niego WebKit odrzuca `getUserMedia` z miejsca
      i skaner mówi „brak zgody", zanim iOS zdąży zapytać.
- [x] Zgoda na aparat wyłącznie dla własnego hosta (`origin.host == url.host`).
- [x] `allowsBackForwardNavigationGestures` — gest cofania działa jak w Safari.
- [x] **Tło widoku.** `isOpaque = true`, a `backgroundColor` bierze
      `UIColor.tloNordo` — dynamiczny kolor zależny od wariantu i od motywu
      systemu. Sklep dostaje `--bg` z arkusza (`#f5f5f5` / `#121212`), magazyn
      `--tlo` z bloku `.mag` (`#f2f2f7` / `#000000`).

      Pilnować przy każdej zmianie palety: wartości siedzą w dwóch miejscach
      i rozjazd widać jako pas obcego koloru nad paskiem stanu i przy odbiciu
      sprężynowym. Tak było, gdy powłoka trzymała `#ede0d4` z palety
      skasowanej w sklepie dwie rundy wcześniej.
- [ ] Jawny limit czasu żądania — `WKWebView` sam nie przerywa wiszących połączeń.

## Safe area

- [x] `viewport-fit=cover` w `viewport` (Next.js `export const viewport`).
- [x] `env(safe-area-inset-top)` i `env(safe-area-inset-bottom)` w CSS magazynu.
- [x] Klasa `w-aplikacji` dokładana dwiema drogami: z User-Agenta powłoki
      (serwer) i z `display-mode: standalone` (skrót z ekranu początkowego).
- [ ] Sprawdzić na iOS 26: przy pasku zakładek z materiału Liquid Glass treść
      strony może wchodzić **pod** pasek. `TabView` w SwiftUI wcina dziś swoje
      dzieci, ale to zachowanie zmieniało się między wydaniami — warto
      zweryfikować na urządzeniu, nie w symulatorze.

Źródło: [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout),
[HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

## Motyw

- [ ] Strona musi reagować na **zmianę** ustawienia systemu w trakcie działania,
      nie tylko przy wczytaniu. Skrypt blokujący czyta `matchMedia` raz;
      potrzebny jeszcze nasłuch:

```js
matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => { /* przełącz klasę, jeśli brak zapisu */ });
```

## Podpisywanie

Konto darmowe: certyfikat wygasa po siedmiu dniach, aplikację trzeba wgrać
ponownie. Konto płatne (99 USD/rok) przedłuża to do roku. `DEVELOPMENT_TEAM`
w `project.pbxproj` musi wskazywać zespół powiązany z Apple ID w Xcode.

## Wydajność

- Czas startu: powłoka jest pusta, więc liczy się wyłącznie czas odpowiedzi
  `/magazyn`. Ekrany magazynu mają `dynamic = 'force-dynamic'` — nic z cache,
  bo liczby zmieniają się przy każdym zamówieniu. To świadomy koszt.
- Pamięć: jedna instancja `WKWebView` na zakładkę, czyli cztery naraz. Przy
  czterech prostych listach to bezpieczne; przy cięższych ekranach warto
  rozważyć zwalnianie nieaktywnych.
