'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Kurtyna przy zmianie strony.
 *
 * `template.tsx`, nie `layout.tsx`: layout w Next zostaje zamontowany między
 * przejściami, więc animacja wejścia odpaliłaby się raz na całą sesję.
 * Template montuje się od nowa przy każdej trasie i dopiero to daje efekt
 * przy każdym przejściu.
 *
 * Sama treść wjeżdża krótkim ruchem w górę i rozjaśnieniem, a nad nią
 * przesuwa się pas w kolorze akcentu — odpowiednik „curtain wipe" z katalogu
 * Motion, zbudowany na `clip-path` zamiast płatnego komponentu.
 *
 * Czasy są tu jedynym miejscem, gdzie referencje przegrywają z użytkownikiem.
 * Cuberto trzyma 1,2 s na ruchu niosącym masę i tak jedzie reszta serwisu
 * (`--ruch-odsloniecie`), ale tam ruch zdobi treść, która już jest na ekranie.
 * Kurtyna stoi między kliknięciem a treścią, więc dostaje 0,6 s — tyle, ile
 * B&O daje swoim przejściom. Sekunda przestałaby być efektem, a stała się
 * opóźnieniem. Krzywa zostaje ta sama co wszędzie: easeOutExpo.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const bezRuchu = useRuchWylaczony();
  const sciezka = usePathname();

  if (bezRuchu) return <>{children}</>;

  return (
    <>
      <motion.div
        key={`kurtyna-${sciezka}`}
        className="kurtyna"
        aria-hidden="true"
        initial={{ clipPath: 'inset(0 0 0 0)' }}
        animate={{ clipPath: 'inset(0 0 100% 0)' }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      />
      <motion.div
        key={sciezka}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
      >
        {children}
      </motion.div>
    </>
  );
}
