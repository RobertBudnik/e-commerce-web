import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { FormularzResetu } from '@/components/auth/FormularzResetu';
import { MARKA } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Nowe hasło',
  description: 'Wyślemy link do ustawienia nowego hasła.',
  robots: { index: false, follow: false },
};

export default function ResetHasla() {
  return (
    <main className="auth auth-jedna">
      <section className="auth-form">
        <div>
          <span className="auth-znak" aria-hidden="true">
            <Icon name="shield" />
          </span>

          <span className="label">Konto</span>
          <h1>Nie pamiętasz hasła?</h1>
          <p className="lede">
            Podaj adres, na który jest założone konto. Wyślemy link do ustawienia nowego hasła —
            ważny godzinę i jednorazowy.
          </p>

          <FormularzResetu />

          <p className="auth-stopka">
            Hasło jednak się znalazło? <Link href="/logowanie">Wróć do logowania</Link>.
          </p>
        </div>
      </section>

      <p className="auth-podpis">{MARKA.nazwa}</p>
    </main>
  );
}
