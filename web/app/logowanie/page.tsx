import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthTabs } from '@/components/auth/AuthTabs';
import { Icon } from '@/components/Icon';
import { getSessionUser } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Logowanie',
  description: 'Zaloguj się do konta Nordo albo załóż nowe.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ powrot?: string; tryb?: string }>;
}) {
  const { powrot, tryb } = await searchParams;

  // Zalogowany nie ma po co oglądać formularza
  const user = await getSessionUser();
  if (user) redirect(powrot ?? '/konto');

  return (
    <main className="auth">
      <section className="auth-form">
        <div>
          <span className="label">Konto</span>
          <h1>Zaloguj się</h1>
          <p className="lede">
            Hasło leci prosto do Supabase Auth i nigdzie po stronie przeglądarki nie jest
            zapisywane. Sesję trzyma ciasteczko ustawiane przez serwer.
          </p>
          <AuthTabs
            defaultTab={tryb === 'rejestracja' ? 'register' : 'login'}
            back={powrot ?? '/konto'}
          />
        </div>
      </section>

      <aside className="auth-aside">
        <div>
          <blockquote>Konto trzyma zamówienia, adres i listę życzeń — nie przeglądarka.</blockquote>
          <cite>Nordo</cite>
          <ul className="auth-perks">
            <li>
              <Icon name="box" /> Historia zamówień i status wysyłki
            </li>
            <li>
              <Icon name="heart" /> Lista życzeń zapisana przy koncie
            </li>
            <li>
              <Icon name="pin" /> Adres dostawy wpisany raz
            </li>
            <li>
              <Icon name="shield" /> Anulowanie zamówienia, zanim ruszy z magazynu
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
