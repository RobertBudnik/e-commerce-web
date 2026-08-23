import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthTabs } from '@/components/auth/AuthTabs';
import { Icon } from '@/components/Icon';
import { getSessionUser } from '@/lib/queries';
import { sciezkaPowrotu } from '@/lib/sciezka-powrotu';

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
  // To samo sprawdzenie co w akcji logowania. Tu jest nawet ważniejsze:
  // przekierowanie niżej dzieje się na zwykłym GET, więc wystarczy, że
  // zalogowany kliknie link — nie musi niczego wysyłać.
  const dokad = sciezkaPowrotu(powrot);

  // Zalogowany nie ma po co oglądać formularza
  const user = await getSessionUser();
  if (user) redirect(dokad);

  return (
    <main className="auth">
      <section className="auth-form">
        <div>
          <span className="label">Konto</span>
          <h1>Zaloguj się</h1>
          <p className="lede">
            Zaloguj się, żeby zobaczyć swoje zamówienia, zapisane adresy i listę
            życzeń. Hasła nie przechowujemy — sprawdzamy je i od razu zapominamy.
          </p>
          <AuthTabs
            defaultTab={tryb === 'rejestracja' ? 'register' : 'login'}
            back={dokad}
          />
        </div>
      </section>

      <aside className="auth-aside">
        <div>
          <blockquote>Zamówienia, adresy i lista życzeń czekają na koncie — także po zmianie urządzenia.</blockquote>
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
