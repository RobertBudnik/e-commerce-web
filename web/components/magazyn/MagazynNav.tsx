import Link from 'next/link';

/**
 * Przełącznik widoków magazynu. Pasek zamiast menu — jedno tapnięcie zamiast
 * dwóch, a przy pakowaniu skacze się między nimi bez przerwy.
 */
export function MagazynNav({ aktywny }: { aktywny: 'zamowienia' | 'stany' | 'skan' }) {
  return (
    <nav className="mag-nav" aria-label="Widoki magazynu">
      <Link href="/magazyn" aria-current={aktywny === 'zamowienia' ? 'page' : undefined}>
        Do spakowania
      </Link>
      <Link href="/magazyn/stany" aria-current={aktywny === 'stany' ? 'page' : undefined}>
        Stany
      </Link>
      <Link href="/magazyn/skan" aria-current={aktywny === 'skan' ? 'page' : undefined}>
        Skaner
      </Link>
    </nav>
  );
}
