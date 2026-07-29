import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { getCategories, getProducts, getSessionUser } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Panel produktów',
  robots: { index: false },
};

/**
 * Panel produktów. Przekierowanie poniżej to wyłącznie UX — o zapisie decyduje
 * polityka `produkty: edycja`, więc konto bez `products.write` dostanie odmowę
 * z bazy niezależnie od tego, co pokaże ten formularz.
 */
export default async function PanelPage() {
  const user = await getSessionUser();
  if (!user) redirect('/logowanie?powrot=/panel');
  if (user.role !== 'admin') redirect('/konto');

  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Panel produktów</h1>
        </div>
        <div className="admin-toolbar">
          <span className="muted">
            <span className="num">{products.length}</span> pozycji w katalogu
          </span>
        </div>
      </div>

      <div className="notice">
        <span>
          Katalog jedzie z bazy — zmiany widzą wszyscy od razu. Zapis przepuszcza dopiero polityka
          RLS <code>produkty: edycja</code>, więc konto bez uprawnienia <code>products.write</code>{' '}
          dostanie odmowę niezależnie od tego, co pokazuje ten formularz.
        </span>
      </div>

      <AdminPanel products={products} categories={categories} />
    </main>
  );
}
