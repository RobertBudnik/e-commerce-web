import type { Metadata } from 'next';
import Link from 'next/link';
import { wymagajBiura } from '@/lib/panel-dostep';
import { getDziennik, getFinanse, getPrzeglad } from '@/lib/queries';
import { money } from '@/lib/format';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = {
  title: 'Pulpit',
  robots: { index: false, follow: false },
};

/** Liczby zmieniają się przy każdym zamówieniu — nic tu nie może iść z cache. */
export const dynamic = 'force-dynamic';

const CZAS = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function Pulpit() {
  const user = await wymagajBiura('/panel');

  const [przeglad, finanse, dziennik] = await Promise.all([
    getPrzeglad(),
    getFinanse(14),
    user.rawRole === 'owner' ? getDziennik() : Promise.resolve([]),
  ]);

  // Porównanie z tym samym dniem tydzień temu, nie z wczoraj: poniedziałek
  // kontra niedziela nie znaczy nic.
  const tydzienTemu = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const wtedy = finanse.dni.find((d) => d.dzien === tydzienTemu)?.przychod ?? 0;
  const roznica = finanse.dzis - wtedy;

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Pulpit</h1>
        </div>
      </div>

      <div className="pw-kafle">
        {/* Znak w barwnym polu na górze kafla — układ z makiety. Ikona jest
            ozdobą liczby, nie jej nośnikiem, więc `aria-hidden` w `Icon`
            zostaje: treść niesie etykieta i sama liczba. */}
        <Link className="pw-kafel" href="/panel/finanse">
          <span className="pw-znak pw-znak-utarg">
            <Icon name="slupki" />
          </span>
          <span className="label">Utarg dziś</span>
          <span className="pw-liczba num">{money(finanse.dzis)}</span>
          <span className="pw-kafel-opis">
            {wtedy === 0
              ? 'brak porównania sprzed tygodnia'
              : `${roznica >= 0 ? '+' : '−'}${money(Math.abs(roznica))} wobec tego dnia tydzień temu`}
          </span>
        </Link>

        <Link className="pw-kafel" href="/panel/zamowienia?stan=kolejka">
          <span className="pw-znak pw-znak-wysylka">
            <Icon name="box" />
          </span>
          <span className="label">Do wysłania</span>
          <span className="pw-liczba num">{przeglad.doWyslania}</span>
          <span className="pw-kafel-opis">zamówień czeka na paczkę</span>
        </Link>

        <Link className="pw-kafel" href="/magazyn/stany?segment=niskie">
          <span className="pw-znak pw-znak-stany">
            <Icon name="grid" />
          </span>
          <span className="label">Niskie stany</span>
          <span className="pw-liczba num">{przeglad.niskieStany}</span>
          <span className="pw-kafel-opis">pozycji poniżej progu</span>
        </Link>

        <Link className="pw-kafel" href="/panel/zamowienia?platnosc=zwrócone">
          <span className="pw-znak pw-znak-zwroty">
            <Icon name="zwrot" />
          </span>
          <span className="label">Zwroty</span>
          <span className="pw-liczba num">{przeglad.zwroty}</span>
          <span className="pw-kafel-opis">zgłoszeń do przyjęcia</span>
        </Link>
      </div>

      {finanse.dni.length < 7 && (
        <div className="notice notice-akcent">
          <Icon name="info" />
          <span>
            Mniej niż tydzień danych — liczby są prawdziwe, ale na trend jest za wcześnie.
            Wykresu w Finansach nie ma z tego samego powodu.
          </span>
        </div>
      )}

      {user.rawRole === 'owner' && (
        <section className="pw-sekcja">
          <div className="pw-sekcja-glowa">
            <h2>Ostatnie zmiany</h2>
            <Link className="pw-link" href="/panel/dziennik">
              Cały dziennik
            </Link>
          </div>

          {dziennik.length === 0 ? (
            <p className="muted">
              Nic jeszcze nie zapisano. Każda zmiana stanu zamówienia, nadanie paczki, zmiana ceny
              i roli zostawi tu ślad z nazwiskiem.
            </p>
          ) : (
            <ul className="pw-lista">
              {dziennik.slice(0, 6).map((w) => (
                <li key={w.id} className="pw-wiersz">
                  <span className="pw-wiersz-czas num">{CZAS.format(new Date(w.czas))}</span>
                  <span className="pw-wiersz-tresc">
                    <strong>{w.obiekt ?? w.obszar}</strong> — {w.opis}
                  </span>
                  <span className="pw-wiersz-kto muted">{w.kto}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
