import type { Metadata } from 'next';
import { Skaner } from '@/components/magazyn/Skaner';
import { wymagajZaplecza } from '@/lib/magazyn-dostep';

export const metadata: Metadata = {
  title: 'Skaner',
  description: 'Odczyt kodu kreskowego i korekta stanu.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function Skan() {
  await wymagajZaplecza('/magazyn/skan');

  return (
    <main className="mag">
      <header className="mag-top">
        <h1>Skaner</h1>
      </header>

      <Skaner />
    </main>
  );
}
