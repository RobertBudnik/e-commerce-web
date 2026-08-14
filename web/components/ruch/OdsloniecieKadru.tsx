'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Kadr odsłaniany przy przewijaniu — zasłona rozsuwa się od dołu, a zdjęcie
 * w środku jedzie wolniej niż strona.
 *
 * Odpowiednik „Scroll Image Reveal" z katalogu Motion, złożony z darmowych
 * API: `useScroll` z celem daje ułamek drogi elementu przez ekran,
 * `useTransform` przekłada go na `clip-path` i na przesunięcie zawartości.
 *
 * Różnica prędkości między zasłoną a zdjęciem robi tu całą robotę — to ona
 * czyta się jako głębia. Sama zasłona bez paralaksy wygląda jak wycieranie
 * ekranu szmatką.
 *
 * `offset` celowo kończy się na „center", a nie na „end": zdjęcie ma być
 * w pełni odsłonięte, gdy dojedzie do środka ekranu, a nie dopiero gdy zaczyna
 * z niego wychodzić.
 */
export function OdsloniecieKadru({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const bezRuchu = useRuchWylaczony();
  const kadr = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: kadr,
    offset: ['start end', 'center center'],
  });

  const zaslona = useTransform(scrollYProgress, [0, 1], ['inset(0 0 100% 0)', 'inset(0 0 0% 0)']);
  const przesuniecie = useTransform(scrollYProgress, [0, 1], [40, 0]);

  if (bezRuchu) {
    return (
      <div ref={kadr} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={kadr} className={className}>
      <motion.div style={{ clipPath: zaslona, height: '100%' }}>
        <motion.div style={{ y: przesuniecie, height: '100%' }}>{children}</motion.div>
      </motion.div>
    </div>
  );
}
