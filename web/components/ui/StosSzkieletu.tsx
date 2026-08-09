/**
 * Szkielet dla widoków, które są listą wierszy, a nie siatką kafelków —
 * konto, panel, koszyk, potwierdzenie zamówienia.
 *
 * Siatka ma swój `GridSkeleton`; ten stos używa tego samego słownika klas,
 * żeby ładowanie wyglądało wszędzie tak samo. Osobny komponent zamiast
 * wklejania trzech `<div>` w każdy `loading.tsx`: cztery kopie tego samego
 * znacznika rozjeżdżają się przy pierwszej poprawce.
 */
export function StosSzkieletu({ wierszy = 3 }: { wierszy?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: wierszy }).map((_, i) => (
        <div className="skeleton-wiersz" key={i}>
          <div className="skeleton-box skeleton-line w-40" />
          <div className="skeleton-box skeleton-line w-70" />
        </div>
      ))}
    </div>
  );
}
