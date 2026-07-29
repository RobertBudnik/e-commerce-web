import type { Metadata } from 'next';
import { CartPage } from '@/components/cart/CartPage';
import { getProfile, getSessionUser } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Koszyk',
  description: 'Podsumowanie zamówienia, kod rabatowy i dane do wysyłki.',
};

/**
 * Zawartość koszyka żyje w przeglądarce, więc sam widok jest wyspą kliencką.
 * Serwer dokłada tylko to, czego klient nie ma: dane zalogowanego konta
 * do formularza. Kwoty i tak przelicza baza.
 */
export default async function KoszykPage() {
  const [user, profile] = await Promise.all([getSessionUser(), getProfile()]);

  return (
    <main className="container section">
      <CartPage
        defaults={{
          name: profile?.name || user?.name || '',
          email: profile?.email || user?.email || '',
          phone: profile?.phone ?? '',
          street: profile?.street ?? '',
          zip: profile?.zip ?? '',
          city: profile?.city ?? '',
        }}
      />
    </main>
  );
}
