import { Badge, Button } from './podstawy';
import type { Odcien } from './podstawy';

export type Produkt = {
  id: string;
  nazwa: string;
  kategoria: string;
  cena: string;
  cenaPrzed?: string;
  znacznik?: { tekst: string; odcien: Odcien };
  dostepny: boolean;
};

const zl = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
export const cena = (grosze: number) => zl.format(grosze / 100);

/**
 * Karta produktu.
 *
 * Zdjęcia jeszcze nie ma i to jest stan normalny, nie awaria — miejsce po nim
 * wypełnia głębszy beż z inicjałem nazwy. Placeholder w kolorze tła znikałby,
 * a szara plama kłóciłaby się z ciepłą bielą całości.
 */
export function KartaProduktu({ produkt }: { produkt: Produkt }) {
  return (
    <article className="group flex flex-col">
      <div className="relative aspect-4/5 overflow-hidden rounded-xl bg-surface transition-colors group-hover:bg-surface-2">
        <span className="font-display absolute inset-0 grid place-items-center text-6xl text-ink-4">
          {produkt.nazwa.charAt(0)}
        </span>
        {produkt.znacznik && (
          <span className="absolute top-3 left-3">
            <Badge odcien={produkt.znacznik.odcien}>{produkt.znacznik.tekst}</Badge>
          </span>
        )}
      </div>

      <p className="t-overline mt-4">{produkt.kategoria}</p>
      <h3 className="t-card-title mt-1">{produkt.nazwa}</h3>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="t-price">{produkt.cena}</span>
        {produkt.cenaPrzed && (
          <span className="t-caption text-ink-3 line-through">{produkt.cenaPrzed}</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button maly disabled={!produkt.dostepny}>
          {produkt.dostepny ? 'Do koszyka' : 'Niedostępny'}
        </Button>
        {produkt.dostepny && <Badge odcien="ok">dostępny</Badge>}
      </div>
    </article>
  );
}

/** Kadr na przykłady w dokumentacji — beż jako tło, żeby białe elementy było widać. */
export function Prezentacja({
  children,
  ciasno,
}: {
  children: React.ReactNode;
  ciasno?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface ${
        ciasno ? 'p-5' : 'p-8'
      }`}
    >
      {children}
    </div>
  );
}
