import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { FormularzLinku } from '@/components/auth/FormularzLinku';
import { getSessionUser } from '@/lib/queries';
import { sciezkaPowrotu } from '@/lib/sciezka-powrotu';
import { MARKA } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Logowanie linkiem',
  description: 'Zaloguj się bez hasła — wyślemy link na twój adres.',
  robots: { index: false, follow: false },
};

export default async function LogowanieLinkiem({
  searchParams,
}: {
  searchParams: Promise<{ powrot?: string }>;
}) {
  const { powrot } = await searchParams;
  const dokad = sciezkaPowrotu(powrot);

  const user = await getSessionUser();
  if (user) redirect(dokad);

  return (
    <main className="auth auth-jedna">
      <section className="auth-form">
        <div>
          <span className="auth-znak" aria-hidden="true">
            <Icon name="box" />
          </span>

          <span className="label">Konto</span>
          <h1>Zaloguj się bez hasła</h1>
          <p className="lede">
            Podaj adres, na który jest założone konto. Wyślemy link, który wpuści cię na konto —
            ważny godzinę i jednorazowy.
          </p>

          <FormularzLinku powrot={dokad} />

          <p className="auth-stopka">
            Wolisz hasło? <Link href="/logowanie">Wróć do zwykłego logowania</Link>.
          </p>
        </div>
      </section>

      <p className="auth-podpis">{MARKA.nazwa}</p>
    </main>
  );
}
