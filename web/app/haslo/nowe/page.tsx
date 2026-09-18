import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { FormularzNowegoHasla } from '@/components/auth/FormularzNowegoHasla';
import { getSessionUser } from '@/lib/queries';
import { MARKA } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Ustaw nowe hasło',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Ustawienie hasła po kliknięciu linku odzyskiwania.
 *
 * Wejście tutaj bez sesji znaczy, że link wygasł, został użyty albo ktoś
 * wpisał adres z palca. Zamiast pustego formularza, który i tak odrzuci
 * zapis, pokazujemy od razu drogę wyjścia.
 */
export default async function NoweHaslo() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="auth auth-jedna">
        <section className="auth-form">
          <div>
            <span className="auth-znak auth-znak-uwaga" aria-hidden="true">
              <Icon name="info" />
            </span>

            <span className="label">Konto</span>
            <h1>Link stracił ważność</h1>
            <p className="lede">
              Link do zmiany hasła działa godzinę i tylko raz. Poproś o nowy — przyjdzie od razu.
            </p>

            <p className="auth-stopka">
              <Link className="btn" href="/haslo/reset">
                Wyślij nowy link
              </Link>
            </p>
          </div>
        </section>

        <p className="auth-podpis">{MARKA.nazwa}</p>
      </main>
    );
  }

  return (
    <main className="auth auth-jedna">
      <section className="auth-form">
        <div>
          <span className="auth-znak" aria-hidden="true">
            <Icon name="shield" />
          </span>

          <span className="label">Konto</span>
          <h1>Ustaw nowe hasło</h1>
          <p className="lede">
            Nowe hasło zacznie działać od razu. Pozostałe zalogowane urządzenia zostaną
            wylogowane.
          </p>

          <FormularzNowegoHasla />
        </div>
      </section>

      <p className="auth-podpis">{MARKA.nazwa}</p>
    </main>
  );
}
