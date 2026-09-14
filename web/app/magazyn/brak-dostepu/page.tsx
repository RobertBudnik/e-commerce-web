import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { signOutAction } from '@/app/actions/auth';
import { getSessionUser } from '@/lib/queries';
import { MARKA } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Brak dostępu',
};

/**
 * Ekran dla kogoś, kto zalogował się kontem bez roli zaplecza i trafił na
 * /magazyn.
 *
 * Ciche odesłanie na konto wyglądałoby jak awaria: hasło było dobre, a mimo
 * to strona podmieniła się bez słowa. Ekran mówi wprost trzy rzeczy: że hasło
 * było dobre, że to kwestia uprawnień, i co dalej.
 *
 * Nie wylogowujemy go z automatu. Konto może być właściwe, tylko rola jeszcze
 * nienadana — a wylogowanie kazałoby wpisywać hasło drugi raz po to samo.
 */
export default async function BrakDostepu() {
  const user = await getSessionUser();

  return (
    <main className="mag mag-brak">
      <div className="mag-brak-srodek">
        <span className="mag-brak-znak" aria-hidden="true">
          <Icon name="shield" />
        </span>

        <h1>Brak dostępu</h1>

        <p className="mag-brak-tresc">
          Hasło się zgadza, ale to konto nie ma uprawnień do magazynu.
          Magazyn jest dostępny wyłącznie dla obsługi sklepu.
        </p>

        {user?.email && <p className="mag-brak-konto">{user.email}</p>}

        <p className="mag-brak-tresc">
          Jeśli to pomyłka, poproś właściciela o nadanie roli pracownika —
          po jej przyznaniu wyloguj się i zaloguj ponownie, żeby uprawnienie
          weszło w życie.
        </p>

        <div className="mag-brak-akcje">
          {/* Wylogowanie jest formularzem z akcją serwerową, nie linkiem:
              to zmiana stanu sesji, a przeglądarki i podglądy potrafią
              wchodzić na linki same. */}
          <form action={signOutAction}>
            <button className="mag-btn" type="submit">
              Wyloguj i zmień konto
            </button>
          </form>
          <Link className="mag-brak-link" href="/">
            Przejdź do sklepu {MARKA.nazwa}
          </Link>
        </div>
      </div>
    </main>
  );
}
