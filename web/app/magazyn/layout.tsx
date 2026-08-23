import type { Metadata } from 'next';

/**
 * Magazyn nie ma czego szukać w wynikach wyszukiwania — to zaplecze firmy,
 * nie treść sklepu. To higiena, nie zabezpieczenie: dostępu pilnują RLS
 * i `wymagajZaplecza()` na każdej stronie.
 *
 * Wyłączenie siedzi w układzie, a nie w każdej stronie z osobna, bo przy
 * ośmiu kopiach tej samej linijki nowa strona pod /magazyn była domyślnie
 * indeksowalna — a o dopisaniu `robots` pamięta się dopiero po fakcie.
 * Metadane układu dziedziczą wszystkie strony pod nim, więc ta pułapka znika.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MagazynLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
