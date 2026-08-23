import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SLUGI_INFO, STRONY_INFO } from '@/lib/strony-informacyjne';

type Props = { params: Promise<{ temat: string }> };

export function generateStaticParams() {
  return SLUGI_INFO.map((temat) => ({ temat }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { temat } = await params;
  const strona = STRONY_INFO[temat];
  if (!strona) return {};
  return { title: strona.tytul, description: strona.wstep };
}

/**
 * Czy pokazać listę braków. Praca lokalna — tak; wdrożenie — tylko na wyraźne
 * życzenie, przez zmienną środowiskową. Sprawdzenie siedzi tutaj, a nie
 * w JSX, żeby dało się je znaleźć jednym grepem.
 */
const pokazBraki =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_POKAZ_BRAKI === '1';

export default async function StronaInformacyjna({ params }: Props) {
  const { temat } = await params;
  const strona = STRONY_INFO[temat];
  if (!strona) notFound();

  return (
    <main className="container doc">
      <nav className="crumbs" aria-label="Ścieżka nawigacji">
        <Link href="/">Start</Link>
        <span aria-hidden="true">/</span>
        <span>{strona.tytul}</span>
      </nav>

      <h1>{strona.tytul}</h1>
      <p className="doc-lead">{strona.wstep}</p>

      {strona.sekcje.map((s) => (
        <section key={s.naglowek} className="doc-section">
          <h2>{s.naglowek}</h2>
          {s.tresc.map((akapit) => (
            <p key={akapit}>{akapit}</p>
          ))}
        </section>
      ))}

      {/* Lista braków jest narzędziem roboczym i tak ma zostać — ale nie na
          oczach klienta. Stała na wdrożeniu, więc polityka prywatności
          ogłaszała wprost „Ścieżka usunięcia konta — dziś nie ma jej w kodzie",
          a regulamin przyznawał, że jego sekcje są instrukcją, nie
          postanowieniem.

          Domyślnie znika wszędzie poza pracą lokalną. Na wdrożeniu podglądowym
          można ją przywrócić, ustawiając NEXT_PUBLIC_POKAZ_BRAKI=1 — nigdy na
          produkcji. */}
      {pokazBraki && strona.doUzupelnienia.length > 0 && (
        <aside className="doc-todo">
          <p className="label">Do uzupełnienia przed startem sprzedaży</p>
          <ul>
            {strona.doUzupelnienia.map((punkt) => (
              <li key={punkt}>{punkt}</li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  );
}
