import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { WyslijPonownie } from '@/components/auth/WyslijPonownie';
import { MARKA } from '@/lib/dane-sklepu';

export const metadata: Metadata = {
  title: 'Link nie zadziałał',
  robots: { index: false, follow: false },
};

/**
 * Ekran zamiast surowego błędu.
 *
 * Link z poczty nie działa z trzech powodów i dla człowieka różnica między
 * „wygasł" a „już go użyto" jest żadna — w obu przypadkach potrzebuje nowego.
 * Dlatego te dwa przypadki mają jedną treść, a osobno stoi tylko sytuacja,
 * w której w adresie w ogóle nie było tokenu.
 */
const POWODY: Record<string, { tytul: string; opis: string; ponownie: boolean }> = {
  wygasl: {
    tytul: 'Link stracił ważność',
    opis: 'Linki z poczty działają godzinę i tylko raz — to samo dotyczy linku, który został już użyty. Poproś o nowy, przyjdzie od razu.',
    ponownie: true,
  },
  odmowa: {
    tytul: 'Nie udało się potwierdzić',
    opis: 'Serwer odrzucił ten link. Zdarza się, gdy klient poczty skróci adres albo rozbije go na dwie linijki. Spróbuj skopiować cały link z wiadomości albo poproś o nowy.',
    ponownie: true,
  },
  brak: {
    tytul: 'Pusty link',
    opis: 'W adresie nie było tokenu potwierdzającego. Najpewniej otworzyłeś tę stronę ręcznie albo link urwał się po drodze.',
    ponownie: false,
  },
};

export default async function BladLinku({
  searchParams,
}: {
  searchParams: Promise<{ powod?: string; adres?: string }>;
}) {
  const { powod, adres } = await searchParams;
  const tresc = POWODY[powod ?? ''] ?? POWODY.brak!;

  return (
    <main className="auth auth-jedna">
      <section className="auth-form">
        <div>
          <span className="auth-znak auth-znak-uwaga" aria-hidden="true">
            <Icon name="info" />
          </span>

          <span className="label">Potwierdzenie</span>
          <h1>{tresc.tytul}</h1>
          <p className="lede">{tresc.opis}</p>

          {tresc.ponownie && adres ? (
            <WyslijPonownie adres={adres} />
          ) : (
            <p className="auth-stopka">
              <Link className="btn" href="/logowanie">
                Przejdź do logowania
              </Link>
            </p>
          )}

          <p className="auth-stopka">
            Konto jest już potwierdzone? <Link href="/logowanie">Zaloguj się</Link>.
          </p>
        </div>
      </section>

      <p className="auth-podpis">{MARKA.nazwa}</p>
    </main>
  );
}
