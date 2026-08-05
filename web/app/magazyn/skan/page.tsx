import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MagazynNav } from '@/components/magazyn/MagazynNav';
import { Skaner } from '@/components/magazyn/Skaner';
import { getSessionUser } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Skaner',
  description: 'Odczyt kodu kreskowego i korekta stanu.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ZAPLECZE = ['owner', 'manager', 'staff'];

export default async function Skan() {
  const user = await getSessionUser();

  if (!user) redirect('/logowanie?powrot=%2Fmagazyn%2Fskan');
  if (!ZAPLECZE.includes(user.rawRole)) redirect('/konto');

  return (
    <main className="container magazyn">
      <header className="magazyn-top">
        <p className="label">Magazyn</p>
        <h1>Skaner</h1>
      </header>

      <MagazynNav aktywny="skan" />
      <Skaner />
    </main>
  );
}
