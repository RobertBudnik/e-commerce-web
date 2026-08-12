import { Avatar, Badge } from './podstawy';

/**
 * Dwie belki, dwie role.
 *
 * Górna należy do sklepu i widzi ją każdy — logo serifem, linki centrum,
 * po prawej sprawy konta. Dolna pojawia się dopiero po zalogowaniu na konto
 * organizacji i to ona zamienia witrynę w narzędzie pracy. Klient nigdy jej
 * nie zobaczy, więc sklep dla niego pozostaje sklepem.
 */

const LINKI = ['Start', 'Sklep', 'Pomoc'];

export const ZAKLADKI = [
  'Pulpit',
  'Zamówienia',
  'Wysyłki',
  'Finanse',
  'Katalog',
  'Ludzie',
  'Dziennik',
] as const;

export type Zakladka = (typeof ZAKLADKI)[number];

export function NawigacjaSklepu() {
  return (
    <nav className="flex h-[52px] items-center gap-8 border-b border-border bg-nav-bg px-6">
      <span className="font-display text-[15px] font-semibold tracking-tight">
        nordo<span className="text-orange">.</span>
      </span>

      <div className="hidden flex-1 justify-center gap-7 md:flex">
        {LINKI.map((l) => (
          <a key={l} className="t-nav text-ink-2 transition-colors hover:text-ink" href="#">
            {l}
          </a>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 md:ml-0">
        <button
          type="button"
          aria-label="Tryb ciemny"
          className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink"
        >
          ☾
        </button>
        <span className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1">
          <Avatar inicjaly="NH" />
          <span className="t-small">Nordo HQ</span>
        </span>
        <button type="button" className="btn btn-ghost btn-sm">
          Koszyk <Badge>2</Badge>
        </button>
      </div>
    </nav>
  );
}

export function BelkaPanelu({ aktywna }: { aktywna: Zakladka }) {
  return (
    <nav className="flex h-11 items-center gap-1 border-b border-border bg-nav-bg px-6">
      {ZAKLADKI.map((z) => {
        const jest = z === aktywna;
        return (
          <a
            key={z}
            href="#"
            aria-current={jest ? 'page' : undefined}
            className={`t-nav -mb-px border-b-2 px-3 py-3 transition-colors ${
              jest ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {z}
          </a>
        );
      })}
      {/* Magazyn to osobne narzędzie na telefon, nie zakładka panelu — stąd
          strzałka i odsunięcie na prawo. */}
      <a href="#" className="t-nav ml-auto text-ink-3 transition-colors hover:text-ink">
        Magazyn ↗
      </a>
    </nav>
  );
}
