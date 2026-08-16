repo: RobertBudnik/e-commerce-web
branch: main
path: web/app/magazyn, web/components/magazyn, web/app/globals.css

reference: kokonut-labs/kokonutui@main (MIT) — źródło wzorców interakcji, nie stylu

## Last sync
date: 2026-08-16T16:41:00Z

### Updated in this project
- Logowanie, reset hasła i ekran blokady (`Magazyn v2 Apple.dc.html`) — jeszcze nie ma ich w repo.
- Wyszukiwarka na ekranie Magazyn: panel wyników, ⌘K, strzałki i Enter (wzorzec `components/kokonutui/action-search-bar.tsx`).
- Nadanie przesyłki i przyjęcie zwrotu przez przytrzymanie (wzorzec `components/kokonutui/hold-button.tsx`).
- Pasek akcji na karcie zamówienia + ulotne potwierdzenia (wzorzec `components/kokonutui/toolbar.tsx`).

## Sync history
### 2026-08-16T00:12:00Z
- Odtworzono siedem ekranów magazynu jako klikalną makietę (`Magazyn.dc.html`).
- Tokeny, promienie i klasy `mag-*` przepisane 1:1 z `web/app/globals.css` (linie 3840–4700).
- Dwie powłoki: telefon z natywnym paskiem czterech zakładek (za `ios/NordoMagazyn/Sources/MagazynView.swift`) i przeglądarka z nagłówkiem sklepu.
- Dane z `scripts/seed-data.mjs` — katalog Audio / Komputery / Foto / Smart home.

## Screen map
| Ekran makiety | Pliki źródłowe |
|---|---|
| Przegląd | web/app/magazyn/page.tsx, web/components/magazyn/MotywAplikacji.tsx |
| Stany | web/app/magazyn/stany/page.tsx, components/magazyn/SegmentyStanow.tsx, SzukajStanow.tsx |
| Korekta stanu | web/app/magazyn/stany/[id]/page.tsx, components/magazyn/KorektaStanu.tsx, web/lib/magazyn-powody.ts |
| Zamówienia | web/app/magazyn/zamowienia/page.tsx |
| Zamówienie | web/app/magazyn/zamowienia/[numer]/page.tsx, components/magazyn/AkcjeZamowienia.tsx |
| Skan | web/app/magazyn/skan/page.tsx, components/magazyn/EkranSkanera.tsx, Skaner.tsx, MotywSkanera.tsx |
| Zwroty | web/app/magazyn/zwroty/page.tsx, components/magazyn/PrzyjmijZwrot.tsx |
| Logowanie / Reset / Blokada | brak w repo — zaprojektowane w makiecie |
| Powłoka (pasek zakładek, tło) | ios/NordoMagazyn/Sources/MagazynView.swift |
| Powłoka (nagłówek sklepu) | web/components/layout/SiteHeader.tsx |
| Tokeny i style `mag-*` | web/app/globals.css |
