'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Treść, która dochodzi i znika w miejscu, nie spychając reszty skokiem.
 *
 * Wzorzec „Clerk: Conditional Field" z katalogu Motion: animowana jest
 * wysokość razem z przejrzystością, więc to, co stoi pod spodem, zjeżdża
 * płynnie zamiast przeskakiwać o wysokość komunikatu.
 *
 * `height: 'auto'` w Motion mierzy element i animuje do zmierzonej wartości,
 * więc działa też wtedy, gdy komunikat złamie się na dwa wiersze.
 * `overflow: hidden` jest konieczny — bez niego treść wystaje poza kurczące
 * się pudełko przez cały czas trwania animacji.
 *
 * Komponent zawsze oddaje `AnimatePresence`, także przy wyłączonym ruchu —
 * wtedy tylko czasy schodzą do zera. Gałąź zwracająca goły fragment
 * wyglądałaby niewinnie, ale `useRuchWylaczony` startuje od `true` i
 * przełącza się po zamontowaniu: React zobaczyłby inny typ elementu w tym
 * samym miejscu i odmontował zawartość tuż po hydratacji.
 */
export function PoleWarunkowe({ children }: { children: React.ReactNode }) {
  const bezRuchu = useRuchWylaczony();

  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={bezRuchu ? { duration: 0 } : { duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
