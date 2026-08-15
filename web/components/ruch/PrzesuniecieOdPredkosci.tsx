'use client';

import { motion, useScroll, useSpring, useTransform, useVelocity } from 'motion/react';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Odkształcenie zależne od prędkości przewijania.
 *
 * Wzorzec „Scroll velocity: linked offset" z katalogu Motion. Łańcuch jest
 * tam ten sam, co tutaj:
 *
 *   useScroll    surowa pozycja
 *   useVelocity  ile pikseli na sekundę — wartość skacze, bo kółko myszy
 *                nie daje ciągłego strumienia
 *   useSpring    wygładzenie tych skoków; bez niego siatka drgałaby
 *   useTransform przełożenie na pochylenie, z twardym zakresem
 *
 * Zakres wejściowy ±1600 px/s jest dobrany do kółka myszy, nie do gestu na
 * gładziku — ten drugi potrafi wyrzucić kilkanaście tysięcy i bez ograniczenia
 * siatka kładłaby się płasko. `clamp` domyślnie przycina wyjście do końców
 * zakresu, więc szybsze przewinięcie nie pochyla już bardziej.
 *
 * Maksimum to 1,6 stopnia. Wyżej robi się z tego efekt sam dla siebie:
 * przy dwóch stopniach widać, że tekst w kaflach stoi krzywo.
 */
export function PrzesuniecieOdPredkosci({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const bezRuchu = useRuchWylaczony();

  const { scrollY } = useScroll();
  const predkosc = useVelocity(scrollY);
  const gladka = useSpring(predkosc, { stiffness: 120, damping: 40, mass: 0.6 });
  const pochylenie = useTransform(gladka, [-1600, 0, 1600], [1.6, 0, -1.6], { clamp: true });

  /* Zawsze `motion.div`, nawet przy wyłączonym ruchu — tylko wartość idzie
     wtedy na zero. Gałąź zwracająca zwykły `<div>` wyglądałaby niewinnie,
     ale `useRuchWylaczony` startuje od `true` i przełącza się dopiero po
     zamontowaniu: React zobaczyłby wtedy inny typ elementu w tym samym
     miejscu i odmontował całą siatkę tuż po hydratacji, gubiąc stan
     kafelków i uruchamiając ujawnianie od nowa. */
  return (
    <motion.div className={className} style={{ skewY: bezRuchu ? 0 : pochylenie }}>
      {children}
    </motion.div>
  );
}
