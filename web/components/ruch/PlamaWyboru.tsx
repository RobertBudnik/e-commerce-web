'use client';

import { motion } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Wypełnienie aktywnego elementu w grupie wyboru.
 *
 * Wspólny `layoutId` sprawia, że przy zmianie zaznaczenia Motion nie
 * odmontowuje jednej plamy i nie montuje drugiej, tylko animuje przejście
 * między ich położeniami — jedna plama przejeżdża wzdłuż grupy. To wzorzec
 * „shared layout animation" z katalogu Motion; API jest publiczne, więc nie
 * potrzeba stamtąd ani linijki kodu.
 *
 * Sprężyna zamiast czasu: takie grupy bywają klikane seriami i sprężyna
 * przejmuje pęd trwającego ruchu, zamiast startować od zera przy każdym
 * dotknięciu. Przy ograniczonym ruchu plama pojawia się na miejscu.
 *
 * `layoutId` musi być unikalny na stronę — dwie grupy z tą samą nazwą
 * przerzucałyby plamę między sobą.
 */
export function PlamaWyboru({
  layoutId,
  className,
}: {
  layoutId: string;
  className: string;
}) {
  const bezRuchu = useRuchWylaczony();

  if (bezRuchu) return <span className={className} aria-hidden="true" />;

  return (
    <motion.span
      className={className}
      aria-hidden="true"
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
    />
  );
}
