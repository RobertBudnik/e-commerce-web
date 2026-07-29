import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountPanel } from '@/components/account/AccountPanel';
import { initials } from '@/lib/format';
import { getCategories, getOrders, getProducts, getProfile, getSessionUser, getWishlist } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Moje konto',
  robots: { index: false },
};

/**
 * Panel konta. Widok zależy od roli, ale ukrywanie sekcji to wyłącznie UX —
 * o zakresie danych decyduje RLS: `orders` oddaje klientowi wiersze z jego
 * `user_id`, a dane kontaktowe innych kont wymagają `customers.read`.
 */
export default async function KontoPage() {
  const user = await getSessionUser();
  if (!user) redirect('/logowanie?powrot=/konto');

  const [orders, wishlist, profile, categories, products] = await Promise.all([
    getOrders(),
    getWishlist(),
    getProfile(),
    getCategories(),
    getProducts(),
  ]);

  return (
    <main className="container">
      <div className="account-head">
        <span className="avatar avatar-lg">{initials(user.name, user.email)}</span>
        <div>
          <h1>{user.name}</h1>
          <span>{user.email}</span>{' '}
          <span className={`pill ${user.role === 'admin' ? 'pill-admin' : ''}`}>
            {user.role === 'admin' ? 'organizacja' : 'klient'}
          </span>
        </div>
      </div>

      <AccountPanel
        user={user}
        orders={orders}
        wishlist={wishlist}
        profile={profile}
        categories={categories}
        catalogCount={products.length}
      />
    </main>
  );
}
