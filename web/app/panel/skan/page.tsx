import type { Metadata } from 'next';
import { Skaner } from '@/components/magazyn/Skaner';
import { wymagajZaplecza } from '@/lib/panel-dostep';

export const metadata: Metadata = {
  title: 'Skaner',
  description: 'Odczyt kodu kreskowego i korekta stanu.',
};

export const dynamic = 'force-dynamic';

/**
 * Skaner ma własną zakładkę, a nie tryb wewnątrz Stanów — to jedyny ekran
 * zaplecza, który realnie pracuje przy regale, w ruchu i jedną ręką. Wejście
 * do niego nie może kosztować dwóch dotknięć.
 *
 * Ekran nie ma już powłoki klienckiej: istniała wyłącznie po to, żeby
 * przełączać motyw skanera, a ten odszedł razem z osobną paletą magazynu.
 * Zostaje nagłówek po stronie serwera i sam kadr z kamery jako komponent
 * kliencki.
 */
export default async function Skan() {
  await wymagajZaplecza('/panel/skan');

  return (
    <main className="mag">
      <header className="mag-top">
        <h1>Skaner</h1>
      </header>

      <Skaner />
    </main>
  );
}
