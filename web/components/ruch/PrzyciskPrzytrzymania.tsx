'use client';

import { useRef, useState } from 'react';
import { animate } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/** Ile trzeba trzymać. Wartość ze specyfikacji makiety. */
const CZAS_MS = 900;

/**
 * Przycisk, który odpala się po przytrzymaniu, nie po dotknięciu.
 *
 * Wzorzec `hold-button` z Kokonut UI (MIT) — przeniesiona mechanika, nie
 * warstwa wizualna. Chroni akcje **nieodwracalne**: nadanie przesyłki
 * i przyjęcie zwrotu. W magazynie telefon leży na stole obok kartonów
 * i przypadkowe tapnięcie zdarza się częściej, niż się wydaje.
 *
 * Trzy rzeczy, które łatwo zrobić źle:
 *
 * 1. **Akcja odpala się z `.finished` tej samej animacji, którą widać na
 *    pasku** — nie z osobnego `setTimeout`. Dwa niezależne zegary rozjeżdżają
 *    się przy każdym przerenderowaniu i pasek dobiega do końca, a akcja nie
 *    leci (albo odwrotnie, co jest gorsze).
 *
 * 2. **Puszczenie unieważnia bieg znacznikiem tożsamości**, nie samym
 *    zatrzymaniem animacji. `.finished` potrafi rozwiązać się już po
 *    `stop()`, więc bez znacznika akcja przechodziłaby mimo puszczenia.
 *
 * 3. **`setPointerCapture`** — bez tego zsunięcie palca poza przycisk gubi
 *    `pointerup` i przycisk zostaje w stanie „trzymam" na zawsze.
 *
 * Przy ograniczonym ruchu paska nie ma, ale przytrzymanie zostaje — to
 * zabezpieczenie, nie ozdoba, więc nie wolno go wyłączyć razem z animacją.
 */
export function PrzyciskPrzytrzymania({
  onHold,
  children,
  etykietaTrzymania = 'Trzymaj…',
  etykietaPoSukcesie,
  disabled,
}: {
  onHold: () => void | Promise<void>;
  children: React.ReactNode;
  etykietaTrzymania?: string;
  etykietaPoSukcesie?: string;
  disabled?: boolean;
}) {
  const bezRuchu = useRuchWylaczony();
  const pasek = useRef<HTMLSpanElement>(null);
  const znacznik = useRef<symbol | null>(null);
  const zegar = useRef<number | null>(null);

  const [trzymam, setTrzymam] = useState(false);
  const [zrobione, setZrobione] = useState(false);

  function przerwij() {
    znacznik.current = null;
    setTrzymam(false);

    if (zegar.current !== null) {
      window.clearTimeout(zegar.current);
      zegar.current = null;
    }
    if (pasek.current) {
      animate(pasek.current, { scaleX: 0 }, { duration: 0.16, ease: 'linear' });
    }
  }

  async function start(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || zrobione || trzymam) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const moj = Symbol('przytrzymanie');
    znacznik.current = moj;
    setTrzymam(true);

    // Bez ruchu nie ma czego animować, ale przytrzymanie musi zostać.
    if (bezRuchu || !pasek.current) {
      zegar.current = window.setTimeout(() => {
        if (znacznik.current !== moj) return;
        zakoncz(moj);
      }, CZAS_MS);
      return;
    }

    const bieg = animate(
      pasek.current,
      { scaleX: [0, 1] },
      { duration: CZAS_MS / 1000, ease: 'linear' }
    );

    try {
      await bieg.finished;
    } catch {
      return; // przerwane — `stop()` odrzuca obietnicę
    }
    if (znacznik.current !== moj) return;
    zakoncz(moj);
  }

  function zakoncz(moj: symbol) {
    if (znacznik.current !== moj) return;
    znacznik.current = null;
    setTrzymam(false);
    setZrobione(true);
    void onHold();
  }

  return (
    <button
      type="button"
      className="mag-trzymaj"
      data-zrobione={zrobione ? '' : undefined}
      disabled={disabled || zrobione}
      onPointerDown={start}
      onPointerUp={przerwij}
      onPointerLeave={przerwij}
      onPointerCancel={przerwij}
    >
      <span className="mag-trzymaj-pasek" ref={pasek} aria-hidden="true" />
      <span className="mag-trzymaj-tresc">
        {zrobione ? (etykietaPoSukcesie ?? 'Gotowe') : trzymam ? etykietaTrzymania : children}
      </span>
    </button>
  );
}
