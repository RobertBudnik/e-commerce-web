'use client';

import { useEffect } from 'react';

/**
 * Stopka odsłaniana spod treści.
 *
 * Odpowiednik „Footer reveal" z katalogu Motion — tamten przykład jest płatny,
 * więc efekt jest zbudowany od zera. Sam ruch nie potrzebuje tu ani jednej
 * animacji: stopka stoi nieruchomo na dnie okna, a treść nad nią jedzie
 * normalnym przewijaniem i stopniowo ją odkrywa. Rzeczy, które nie muszą się
 * animować, żeby wyglądać na animowane, są tańsze od tych, które muszą.
 *
 * Jedyne, czego brakuje CSS-owi, to wysokość stopki — treść musi zarezerwować
 * pod sobą dokładnie tyle miejsca, ile stopka zajmuje, inaczej albo ją
 * przykryje, albo zostawi lukę. Ten komponent nic nie renderuje; mierzy
 * stopkę i zapisuje wynik do zmiennej `--stopka-h`, a resztę robi arkusz.
 *
 * `ResizeObserver`, nie pomiar przy montowaniu: stopka zmienia wysokość przy
 * obrocie telefonu, przy zawijaniu kolumn i wtedy, gdy dochodzi komunikat
 * o brakujących danych sprzedawcy.
 */
export function OdsloniecieStopki() {
  useEffect(() => {
    const stopka = document.querySelector<HTMLElement>('.site-footer');
    if (!stopka) return;

    const korzen = document.documentElement;

    // Efekt włączamy dopiero, gdy znamy wysokość — do tego czasu strona
    // wygląda i działa jak zwykła, bez skoku układu w trakcie wczytywania.
    const zmierz = () => {
      korzen.style.setProperty('--stopka-h', `${Math.round(stopka.offsetHeight)}px`);
      korzen.classList.add('stopka-odslaniana');
    };

    zmierz();
    const obserwator = new ResizeObserver(zmierz);
    obserwator.observe(stopka);

    return () => {
      obserwator.disconnect();
      korzen.classList.remove('stopka-odslaniana');
      korzen.style.removeProperty('--stopka-h');
    };
  }, []);

  return null;
}
