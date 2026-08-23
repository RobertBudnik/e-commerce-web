#!/usr/bin/env bash
# =============================================================================
# Buduje i wgrywa dwie aplikacje z jednego celu Xcode.
#
# Powłoka jest ta sama — różni je pięć ustawień: adres startowy, identyfikator
# pakietu, nazwa, zestaw ikon i wariant. Dzięki temu obie stoją obok siebie na
# urządzeniu jako osobne programy, a my nie utrzymujemy dwóch kopii kodu.
#
# `NORDO_WARIANT` jest tu kluczowy: to on decyduje, czy powłoka pokaże pasek
# zakładek magazynu, czy jeden ciąg stron sklepu, i którą paletę weźmie na tło
# obszarów bezpiecznych. Bez niego oba pakiety pokazywały zaplecze.
#
# Dlaczego nadpisanie ustawień, a nie drugi cel w projekcie: dodanie celu
# oznacza ręczną edycję `project.pbxproj`, pliku, który Xcode generuje sam
# i który przy błędzie przestaje się otwierać. Nadpisanie z linii poleceń
# daje ten sam wynik i nie dotyka projektu.
#
#   ./zbuduj.sh sklep   <udid>   — aplikacja klienta
#   ./zbuduj.sh magazyn <udid>   — aplikacja zaplecza
#   ./zbuduj.sh obie    <udid>   — obie po kolei
#
# Bez `udid` buduje bez instalacji. Lista urządzeń: xcrun devicectl list devices
# =============================================================================
set -euo pipefail

BAZA="${NORDO_BAZA:-https://nordo-one.vercel.app}"
KATALOG="$(cd "$(dirname "$0")" && pwd)"

zbuduj() {
  local wariant="$1" udid="${2:-}"
  local bundle nazwa adres ikona dd

  case "$wariant" in
    sklep)
      bundle="pl.nordo.sklep"; nazwa="Nordo"; adres="$BAZA/"
      ikona="AppIconSklep" ;;
    magazyn)
      bundle="pl.nordo.magazyn"; nazwa="Nordo Magazyn"; adres="$BAZA/magazyn"
      # Magazyn zostaje przy `AppIcon`, bo to on jest wariantem domyślnym
      # projektu — build z „Run" w Xcode ma dawać zaplecze, nie sklep.
      ikona="AppIcon" ;;
    *)
      echo "Nieznany wariant: $wariant (sklep | magazyn | obie)" >&2; exit 2 ;;
  esac

  dd="/tmp/nordo-$wariant"
  echo "── $wariant · $bundle · $adres"

  # `-destination generic/platform=iOS` buduje pod urządzenie bez wskazywania
  # konkretnego — instalujemy osobno przez devicectl, żeby ten sam build dało
  # się wgrać na kilka telefonów.
  xcodebuild -project "$KATALOG/NordoMagazyn.xcodeproj" \
    -scheme NordoMagazyn -configuration Debug \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$dd" -allowProvisioningUpdates \
    PRODUCT_BUNDLE_IDENTIFIER="$bundle" \
    PRODUCT_NAME="$nazwa" \
    NORDO_URL="$adres" \
    NORDO_WARIANT="$wariant" \
    ASSETCATALOG_COMPILER_APPICON_NAME="$ikona" \
    build >/dev/null

  local app="$dd/Build/Products/Debug-iphoneos/$nazwa.app"
  echo "   zbudowane: $app"

  if [ -n "$udid" ]; then
    xcrun devicectl device install app --device "$udid" "$app" >/dev/null
    echo "   wgrane na $udid"
  fi
}

case "${1:-obie}" in
  obie) zbuduj sklep "${2:-}"; zbuduj magazyn "${2:-}" ;;
  *)    zbuduj "$1" "${2:-}" ;;
esac
