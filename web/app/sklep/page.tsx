import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShopBrowser } from '@/components/product/ShopBrowser';
import { getCategories, getProducts } from '@/lib/queries';
import { storeMode } from '@/lib/store-mode';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Sklep',
  description: 'Wszystkie produkty w sklepie Nordo — filtruj po kategorii, sortuj po cenie i ocenie.',
};

/**
 * Lista renderuje się na serwerze: robot i czytelnik dostają gotowy HTML
 * z produktami, a nie pustą siatkę do wypełnienia przez JavaScript.
 * Filtrowanie i sortowanie przejmuje potem wyspa kliencka.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ kategoria?: string; sort?: string; szukaj?: string; mode?: string }>;
}) {
  const params = await searchParams;

  // W trybie jednoproduktowym lista nie ma czego pokazywać — cała sprzedaż
  // dzieje się na stronie głównej.
  if (storeMode(params) === 'single') redirect('/');

  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Katalog</span>
          <h1>Sklep</h1>
        </div>
      </div>

      <ShopBrowser
        products={products}
        categories={categories}
        initialCategory={params.kategoria ?? 'all'}
        initialSort={params.sort ?? 'popular'}
        initialQuery={params.szukaj ?? ''}
      />
    </main>
  );
}
