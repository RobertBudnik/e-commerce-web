'use client';

import { Skaner } from './Skaner';
import { klasaMotywu, PrzelacznikMotywu, useMotywSkanera } from './MotywSkanera';

/**
 * Ekran skanera razem z wyborem motywu.
 *
 * Motyw musi objąć cały ekran, nie sam kadr: jasny kadr w ciemnej ramce
 * i odwrotnie męczy bardziej niż jedno i drugie osobno. Dlatego klasa siada
 * na `main`, a nie na obrazie z kamery — i dlatego ten ekran ma własną
 * powłokę kliencką zamiast renderować się w całości po stronie serwera.
 */
export function EkranSkanera() {
  const [motyw, ustawMotyw] = useMotywSkanera();

  return (
    <main className={`mag${klasaMotywu(motyw)}`}>
      <header className="mag-top">
        <h1>Skaner</h1>
      </header>

      <PrzelacznikMotywu motyw={motyw} onZmiana={ustawMotyw} />

      <Skaner />
    </main>
  );
}
