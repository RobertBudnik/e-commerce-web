'use client';

import { useEffect, useState } from 'react';
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
 * przesuwa się pas w kolorze tła — odpowiednik „curtain wipe" z katalogu
 * Motion, zbudowany na `clip-path` zamiast płatnego komponentu.
 *
 * Czasy są tu jedynym miejscem, gdzie referencje przegrywają z użytkownikiem.
 * Cuberto trzyma 1,2 s na ruchu niosącym masę i tak jedzie reszta serwisu
 * (`--ruch-odsloniecie`), ale tam ruch zdobi treść, która już jest na ekranie.
 * Kurtyna stoi między kliknięciem a treścią, więc dostaje 0,35 s.
 */

/**
 * Trasa, z której przyszliśmy — `null` przy pierwszym otwarciu strony.
 *
 * Zmienna modułowa, bo template montuje się od nowa przy każdym przejściu
 * i stan komponentu nie przeżyje nawigacji. Zapis dzieje się wyłącznie
 * w efekcie, więc po stronie serwera ta wartość zostaje `null` na zawsze
 * i pierwszy render serwera zgadza się z pierwszym renderem klienta.
 */
let poprzedniaSciezka: string | null = null;

export default function Template({ children }: { children: React.ReactNode }) {
  const bezRuchu = useRuchWylaczony();
  const sciezka = usePathname();

  /**
   * Czy to przejście między trasami, czy pierwsze otwarcie strony.
   *
   * To rozróżnienie jest sednem poprawki. Wcześniej kurtyna grała także przy
   * pierwszym wejściu — a tam nie ma z czego przechodzić: treść jest już
   * wyrenderowana na serwerze i widoczna, więc pas w kolorze tła zasłaniał
   * to, co użytkownik właśnie zobaczył, i dopiero potem zjeżdżał.
   *
   * W produkcji trwało to 0,35 s i uchodziło za efekt. W trybie
   * deweloperskim tryb ścisły Reacta montuje komponent dwa razy, animacja
   * się urywa i kurtyna zostaje na `inset(0)` — czyli cała strona znika pod
   * jednolitą płachtą, na stałe.
   *
   * `useRuchWylaczony` zaczyna od `true`, więc przy pierwszym renderze
   * kurtyny nie ma w ogóle; montuje się dopiero po zamontowaniu, gdy
   * zapytanie medialne odpowie. Stąd brała się cała sekwencja.
   */
  const [zPrzejscia] = useState(
    () => poprzedniaSciezka !== null && poprzedniaSciezka !== sciezka
  );

  useEffect(() => {
    poprzedniaSciezka = sciezka;
  }, [sciezka]);

  // Pierwsze wejście i wyłączony ruch idą tą samą drogą: treść bez opakowania.
  // Nie ma czego animować, a każdy dodatkowy węzeł to kolejna okazja, żeby
  // coś zostało w stanie początkowym.
  if (bezRuchu || !zPrzejscia) return <>{children}</>;

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
