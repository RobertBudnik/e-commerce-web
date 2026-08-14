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
 * Czasy krótkie i to jest świadome: użytkownik czeka tu na treść, więc górna
 * granica z makiety (0,6 s na kadr) jest tu sufitem, nie celem. Kurtyna, która
 * trwa sekundę, przestaje być efektem, a staje się opóźnieniem.
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
        transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      <motion.div
        key={sciezka}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.08 }}
      >
        {children}
      </motion.div>
    </>
  );
}
