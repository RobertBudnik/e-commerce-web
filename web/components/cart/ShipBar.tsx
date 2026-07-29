import { money } from '@/lib/format';

/** Ile brakuje do darmowej dostawy. Próg przychodzi z wyceny liczonej w bazie. */
export function ShipBar({ value, goal }: { value: number; goal: number }) {
  const done = value >= goal;
  const percent = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 100;

  return (
    <div className={`ship-bar${done ? ' is-free' : ''}`}>
      <p>
        {done ? (
          'Dostawa gratis — próg osiągnięty.'
        ) : (
          <>
            Do darmowej dostawy brakuje <strong className="num">{money(goal - value)}</strong>.
          </>
        )}
      </p>
      <div
        className="ship-bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Postęp do darmowej dostawy"
      >
        <div className="ship-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
