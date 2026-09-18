import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { WyslijPonownie } from '@/components/auth/WyslijPonownie';
import { MARKA } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Sprawdź skrzynkę',
  description: 'Potwierdź adres e-mail, żeby dokończyć zakładanie konta.',
  robots: { index: false, follow: false },
};

/**
 * Ekran między rejestracją a potwierdzeniem.
 *
 * Konto już istnieje, ale nie da się na nie wejść — i to jest dokładnie ta
 * chwila, w której człowiek najczęściej odpada. Dlatego strona mówi trzy
 * rzeczy wprost: na jaki adres poszła wiadomość, że bywa w spamie, i co
 * zrobić, gdy nie doszła.
 */
export default async function SprawdzSkrzynke({
  searchParams,
}: {
  searchParams: Promise<{ adres?: string }>;
}) {
  const { adres } = await searchParams;

  // Bez adresu ta strona nie ma o czym mówić ani czego wysłać ponownie.
  if (!adres) redirect('/logowanie?tryb=rejestracja');

  return (
    <main className="auth auth-jedna">
      <section className="auth-form">
        <div>
          <span className="auth-znak" aria-hidden="true">
            <Icon name="box" />
          </span>

          <span className="label">Ostatni krok</span>
          <h1>Sprawdź skrzynkę</h1>

          <p className="lede">
            Wysłaliśmy wiadomość na <strong className="auth-adres">{adres}</strong>. Kliknij link
            w środku, żeby potwierdzić adres i dokończyć zakładanie konta.
          </p>

          <ul className="auth-wskazowki">
            <li>
              <Icon name="info" />
              <span>
                Wiadomość potrafi trafić do <strong>spamu</strong> albo do zakładki „Oferty”.
                Zajrzyj tam, zanim wyślesz ponownie.
              </span>
            </li>
            <li>
              <Icon name="shield" />
              <span>
                Link jest ważny <strong>godzinę</strong> i działa jeden raz. Otworzysz go na
                dowolnym urządzeniu — nie musi to być ta sama przeglądarka.
              </span>
            </li>
          </ul>

          <WyslijPonownie adres={adres} />

          <p className="auth-stopka">
            Wpisany adres jest niepoprawny?{' '}
            <Link href="/logowanie?tryb=rejestracja">Zarejestruj się jeszcze raz</Link>.
          </p>
        </div>
      </section>

      <p className="auth-podpis">{MARKA.nazwa}</p>
    </main>
  );
}
