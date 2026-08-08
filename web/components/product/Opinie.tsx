import { FormularzOpinii } from './FormularzOpinii';
import { formatDate, stars } from '@/lib/format';
import { ile, odmien, type Formy } from '@/lib/odmiana';
import type { Opinia } from '@/lib/queries';

/** „1 opinia", „2 opinie", „5 opinii" — orzeczenie idzie za podmiotem. */
const OPINIE: Formy = ['opinia', 'opinie', 'opinii'];

/**
 * Sekcja opinii pod specyfikacją produktu.
 *
 * Komponent serwerowy: lista opinii to treść, nie interakcja. Kliencki jest
 * wyłącznie formularz, i to tylko wtedy, gdy w ogóle się pokazuje.
 */
export function Opinie({
  produktId,
  slug,
  opinie,
  mogeOceniac,
}: {
  produktId: string;
  slug: string;
  opinie: Opinia[];
  mogeOceniac: boolean;
}) {
  const moja = opinie.find((o) => o.wlasna);

  return (
    <section className="section opinie" id="opinie">
      <div className="section-head">
        <div>
          <span className="label">Od kupujących</span>
          <h2>Opinie</h2>
        </div>
        {opinie.length > 0 && (
          <span className="muted num">{ile(opinie.length, OPINIE)}</span>
        )}
      </div>

      {opinie.length === 0 ? (
        <p className="muted">
          {mogeOceniac
            ? 'Nikt jeszcze nie ocenił tego produktu — możesz być pierwszy.'
            : 'Nikt jeszcze nie ocenił tego produktu. Opinie wystawiają kupujący po odebraniu zamówienia.'}
        </p>
      ) : (
        <ul className="opinia-lista">
          {opinie.map((o) => (
            <li className="opinia" key={o.id}>
              <div className="opinia-glowa">
                <span className="stars" aria-hidden="true">
                  {stars(o.ocena)}
                </span>
                <span className="sr-only">
                  Ocena {o.ocena} na 5 — {odmien(o.ocena, OPINIE)}
                </span>
                <span className="opinia-autor">
                  {o.autor}
                  {o.wlasna && <span className="opinia-moja"> · Twoja opinia</span>}
                </span>
                <span className="opinia-data muted num">{formatDate(o.data)}</span>
              </div>
              {o.tresc && <p className="opinia-tresc">{o.tresc}</p>}
            </li>
          ))}
        </ul>
      )}

      {mogeOceniac && (
        <FormularzOpinii produktId={produktId} slug={slug} mojaOcena={moja?.ocena} />
      )}
    </section>
  );
}
