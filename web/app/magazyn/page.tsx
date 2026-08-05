import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { InstallHint } from '@/components/magazyn/InstallHint';
import { MagazynNav } from '@/components/magazyn/MagazynNav';
import { PackCard } from '@/components/magazyn/PackCard';
import { getOrdersToPack, getSessionUser } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Magazyn',
  description: 'Kolejka pakowania — zamówienia do obsłużenia.',
  robots: { index: false, follow: false },
};

/** Kolejka zmienia się przy każdym zamówieniu — nic tu nie może iść z cache. */
export const dynamic = 'force-dynamic';

const ZAPLECZE = ['owner', 'manager', 'staff'];

export default async function Magazyn() {
  const user = await getSessionUser();

  // Przekierowanie to wyłącznie wygoda. Prawdziwej zapory pilnują polityki
  // RLS: konto klienta nie zobaczy cudzych zamówień nawet po wpisaniu adresu
  // z palca, bo baza mu ich nie odda.
  if (!user) redirect('/logowanie?powrot=%2Fmagazyn');
  if (!ZAPLECZE.includes(user.rawRole)) redirect('/konto');

  const zamowienia = await getOrdersToPack();
  const nowe = zamowienia.filter((z) => z.status === 'nowe').length;

  return (
    <main className="container magazyn">
      <header className="magazyn-top">
        <p className="label">Magazyn</p>
        <h1>Do spakowania</h1>
        <p className="magazyn-licznik num">
          {zamowienia.length === 0
            ? 'Kolejka pusta'
            : `${zamowienia.length} w kolejce${nowe ? ` · ${nowe} nowych` : ''}`}
        </p>
      </header>

      <MagazynNav aktywny="zamowienia" />

      <InstallHint />

      {zamowienia.length === 0 ? (
        <p className="magazyn-pusto">
          Nic nie czeka na wysyłkę. Nowe zamówienia pojawią się tutaj same.
        </p>
      ) : (
        <div className="magazyn-lista">
          {zamowienia.map((z) => (
            <PackCard key={z.id} order={z} />
          ))}
        </div>
      )}
    </main>
  );
}
