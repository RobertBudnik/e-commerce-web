'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { Icon } from '@/components/Icon';
import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Przycisk „do koszyka" z potwierdzeniem w miejscu.
 *
 * Wzorzec „Add to basket" z katalogu Motion. Trzy warstwy ruchu, każda robi
 * co innego:
 *
 *   whileTap  — przycisk ustępuje pod palcem. Jedyny ruch, który dzieje się
 *               *zanim* cokolwiek poleci do serwera, więc to on niesie
 *               informację „kliknięcie zarejestrowane".
 *   sekwencja — po dodaniu przycisk drga w pionie. Krótko i raz.
 *   podmiana  — napis ustępuje miejsca potwierdzeniu na 1,4 s i wraca.
 *
 * Potwierdzenie wraca samo, bo przycisk musi dać się kliknąć drugi raz —
 * ktoś, kto bierze dwie sztuki, nie powinien czekać, aż znaczek zgaśnie.
 *
 * Stan `dodane` jest wyłącznie wizualny; liczba w koszyku i tak jedzie z
 * providera. Gdyby ten przycisk był jedynym źródłem informacji o powodzeniu,
 * animacja kłamałaby przy błędzie zapisu.
 */
export function PrzyciskDoKoszyka({
  onAdd,
  disabled,
  children,
  ikona = false,
  etykieta,
}: {
  onAdd: (el: HTMLElement) => void;
  disabled?: boolean;
  children: React.ReactNode;
  /**
   * Wariant kwadratowy z samym znakiem — tak wygląda dodawanie z kafla
   * w makiecie. Cała mechanika ruchu zostaje ta sama; zmienia się kształt
   * i to, że `children` przestaje być widoczne.
   */
  ikona?: boolean;
  /**
   * Nazwa dostępna. Obowiązkowa przy wariancie ikonowym, bo bez napisu
   * przycisk nie ma z czego jej wziąć — czytnik ekranu przeczytałby
   * „przycisk" i nic więcej.
   */
  etykieta?: string;
}) {
  const bezRuchu = useRuchWylaczony();
  const [zakres, animuj] = useAnimate();
  const [dodane, setDodane] = useState(false);

  const klik = (e: React.MouseEvent<HTMLButtonElement>) => {
    onAdd(e.currentTarget);

    if (bezRuchu) return;

    setDodane(true);
    animuj(zakres.current, { y: [0, -4, 0] }, { duration: 0.32, ease: [0.16, 1, 0.3, 1] });
    window.setTimeout(() => setDodane(false), 1400);
  };

  return (
    <motion.button
      ref={zakres}
      className={
        ikona ? 'przycisk-koszyk przycisk-koszyk-ikona' : 'btn btn-ghost btn-block przycisk-koszyk'
      }
      type="button"
      disabled={disabled}
      aria-label={etykieta}
      onClick={klik}
      whileHover={bezRuchu || disabled ? undefined : { scale: 1.02 }}
      whileTap={bezRuchu || disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {/* Napis i potwierdzenie leżą na sobie, nie obok siebie — inaczej
          przycisk zmieniałby szerokość w trakcie podmiany. */}
      {/* Bez `mode="wait"`: obie warstwy i tak leżą w jednej komórce siatki,
          więc mogą się przenikać. Czekanie na wyjście poprzedniej dokładało
          tylko opóźnienie między kliknięciem a potwierdzeniem. */}
      <span className="przycisk-koszyk-warstwa">
        <AnimatePresence initial={false}>
          {dodane ? (
            <motion.span
              key="dodane"
              className="przycisk-koszyk-tresc"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <Icon name="check" />
              {!ikona && ' W koszyku'}
            </motion.span>
          ) : (
            <motion.span
              key="dodaj"
              className="przycisk-koszyk-tresc"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {ikona ? <Icon name="cart" /> : children}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
