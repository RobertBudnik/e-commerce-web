import type { Metadata } from 'next';
import { EkranSkanera } from '@/components/magazyn/EkranSkanera';
import { wymagajZaplecza } from '@/lib/magazyn-dostep';

export const metadata: Metadata = {
  title: 'Skaner',
  description: 'Odczyt kodu kreskowego i korekta stanu.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function Skan() {
  await wymagajZaplecza('/magazyn/skan');

  // Nagłówek i wybór motywu rysuje powłoka kliencka — motyw obejmuje cały
  // ekran, więc musi siedzieć nad nagłówkiem, nie pod nim.
  return <EkranSkanera />;
}
