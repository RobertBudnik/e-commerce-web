'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Zachowanie okna nakładkowego: szuflady, modala, arkusza na telefonie.
 *
 * Sześć komponentów miało to wcześniej przepisane od nowa — koszyk, szybki
 * podgląd, nawigacja mobilna, zgłoszenie zwrotu, akcje zamówienia i lista
 * sortowania. Każdy trochę inaczej, więc Escape działał wszędzie, powrót
 * fokusu w dwóch miejscach, a pułapka fokusu tylko w jednym. Rozjazd nie brał
 * się z decyzji projektowych, tylko z tego, że nikt nie przepisał wszystkiego
 * naraz po tej samej poprawce.
 *
 * Hak robi pięć rzeczy, których wymaga skill designu od każdego elementu
 * nakładkowego:
 *
 * 1. Escape zamyka.
 * 2. Fokus wchodzi do panelu przy otwarciu.
 * 3. Fokus wraca na element wyzwalający przy zamknięciu.
 * 4. Tab krąży wewnątrz panelu i nie ucieka na treść pod spodem.
 * 5. Strona pod spodem nie przewija się, dopóki okno jest otwarte.
 *
 * Blokada przewijania jest liczona, a nie ustawiana na sztywno: dwa okna
 * otwarte jednocześnie (szybki podgląd nad szufladą koszyka) przy zwykłym
 * przypisaniu odblokowywały stronę po zamknięciu pierwszego z nich.
 */

/** Elementy, na które Tab może wejść. */
const OGNISKOWALNE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Otwarte okna, po jednym wpisie na wywołanie haka.
 *
 * Zbiór, a nie licznik: licznik potrafi zostać rozstrojony, gdy odmontowanie
 * przepadnie przy przeładowaniu modułu w trakcie pracy, i wtedy strona zostaje
 * zablokowana bez ani jednego otwartego okna. Zbiór wraca do zera razem
 * z modułem, a przy podwójnym wywołaniu efektu ten sam znacznik wpada
 * i wypada bez zmiany wyniku.
 */
const otwarteOkna = new Set<symbol>();

function zablokujPrzewijanie(znacznik: symbol) {
  otwarteOkna.add(znacznik);
  document.body.style.overflow = 'hidden';
}

function odblokujPrzewijanie(znacznik: symbol) {
  otwarteOkna.delete(znacznik);
  if (otwarteOkna.size === 0) document.body.style.overflow = '';
}

export type OknoModalne = {
  /** Czy okno jest otwarte. */
  otwarte: boolean;
  /** Panel okna — stąd bierze się pierwszy cel fokusu i granice pułapki. */
  panel: RefObject<HTMLElement | null>;
  /** Wywoływane przy Escape. */
  zamknij: () => void;
  /**
   * Element, na który wraca fokus. Bez niego hak wraca tam, gdzie fokus był
   * przed otwarciem — to zwykle to samo, ale przycisk znikający razem z oknem
   * (np. pozycja listy) nie ma już gdzie przyjąć fokusu.
   */
  wyzwalacz?: RefObject<HTMLElement | null>;
  /**
   * Selektor pierwszego celu fokusu. Domyślnie pierwszy ogniskowalny element.
   * Przydaje się, gdy fokus ma trafić w pole, a nie w przycisk zamykania.
   */
  pierwszyCel?: string;
};

export function useOknoModalne({ otwarte, panel, zamknij, wyzwalacz, pierwszyCel }: OknoModalne) {
  useEffect(() => {
    if (!otwarte) return;

    const znacznik = Symbol('okno');
    const poprzedniFokus = document.activeElement as HTMLElement | null;
    zablokujPrzewijanie(znacznik);

    // Panel montuje się w tym samym przebiegu, ale przy portalu bywa, że
    // referencja jest gotowa dopiero po odmalowaniu — stąd sprawdzenie.
    const wejscie = pierwszyCel
      ? panel.current?.querySelector<HTMLElement>(pierwszyCel)
      : panel.current?.querySelector<HTMLElement>(OGNISKOWALNE);
    wejscie?.focus();

    function naKlawisz(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        zamknij();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;

      // Widoczność sprawdzana prostokątami, nie przez `offsetParent`: panele
      // okien stoją na `position: fixed`, a tam `offsetParent` jest zawsze
      // `null` i cała lista wychodziła pusta — pułapka po cichu nie działała.
      const cele = [...panel.current.querySelectorAll<HTMLElement>(OGNISKOWALNE)].filter(
        (el) => el.getClientRects().length > 0
      );
      if (!cele.length) return;

      const pierwszy = cele[0];
      const ostatni = cele[cele.length - 1];

      if (e.shiftKey && document.activeElement === pierwszy) {
        e.preventDefault();
        ostatni.focus();
      } else if (!e.shiftKey && document.activeElement === ostatni) {
        e.preventDefault();
        pierwszy.focus();
      }
    }

    document.addEventListener('keydown', naKlawisz);

    return () => {
      document.removeEventListener('keydown', naKlawisz);
      odblokujPrzewijanie(znacznik);
      // Wyzwalacz przed poprzednim fokusem: element, z którego okno wystartowało,
      // przeżywa zamknięcie częściej niż to, co akurat było aktywne.
      (wyzwalacz?.current ?? poprzedniFokus)?.focus();
    };
    // `zamknij` bywa nową funkcją przy każdym renderze wywołującego, a hak ma
    // się przewiązywać wyłącznie przy zmianie stanu otwarcia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otwarte]);
}
