import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MagazynNav } from '@/components/magazyn/MagazynNav';
import { StockRow } from '@/components/magazyn/StockRow';
import { getSessionUser, getStockLevels } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Stany magazynowe',
  description: 'Ilości na stanie i korekty.',
  robots: { index: false, follow: false },
};

/** Stan zmienia się przy każdym zamówieniu — nic tu nie może iść z cache. */
export const dynamic = 'force-dynamic';

const ZAPLECZE = ['owner', 'manager', 'staff'];

export default async function Stany() {
  const user = await getSessionUser();

  // Zaporą są polityki RLS i sprawdzenie `inventory.write` w adjust_stock().
  // Przekierowanie to wyłącznie wygoda.
  if (!user) redirect('/logowanie?powrot=%2Fmagazyn%2Fstany');
  if (!ZAPLECZE.includes(user.rawRole)) redirect('/konto');

  const produkty = await getStockLevels();
  const brakujace = produkty.filter((p) => p.stock === 0).length;
  const konczace = produkty.filter((p) => p.stock > 0 && p.stock <= 5).length;

  return (
    <main className="container magazyn">
      <header className="magazyn-top">
        <p className="label">Magazyn</p>
        <h1>Stany</h1>
        <p className="magazyn-licznik num">
          {produkty.length} produktów
          {brakujace > 0 && ` · ${brakujace} bez stanu`}
          {konczace > 0 && ` · ${konczace} na wyczerpaniu`}
        </p>
      </header>

      <MagazynNav aktywny="stany" />

      {produkty.length === 0 ? (
        <p className="magazyn-pusto">
          Katalog jest pusty. Produkty dodasz w panelu na komputerze.
        </p>
      ) : (
        <ul className="stock-lista">
          {produkty.map((p) => (
            <StockRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </main>
  );
}
