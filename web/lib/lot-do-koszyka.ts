'use client';

/**
 * Produkt leci z kafla do ikony koszyka.
 *
 * To nie jest ozdoba, tylko odpowiedź na pytanie „czy się dodało i gdzie to
 * poszło". Bez niej po kliknięciu „Do koszyka" zmienia się wyłącznie liczba
 * w rogu ekranu — czyli dokładnie to miejsce, na które nikt w tej chwili nie
 * patrzy, bo patrzy na produkt. Lot prowadzi wzrok stamtąd, gdzie był, tam,
 * gdzie zaszła zmiana.
 *
 * Klon jest `position: fixed` i leży poza układem, więc nic nie przelicza się
 * przy locie. Animujemy `transform` i `opacity`, zgodnie z regułą skilla.
 *
 * Nie wołamy tego przy wyłączonym ruchu — sprawdzenie zostaje po stronie
 * wywołującego, bo tam i tak stoi już haczyk `useRuchWylaczony`.
 */
export function lotDoKoszyka(zrodlo: Element | null) {
  if (typeof window === 'undefined' || !zrodlo) return;

  const cel = document.querySelector('.cart-btn');
  if (!cel) return;

  const start = zrodlo.getBoundingClientRect();
  const koniec = cel.getBoundingClientRect();
  if (!start.width || !koniec.width) return;

  const klon = zrodlo.cloneNode(true) as HTMLElement;

  // Klon nie ma prawa nieść niczego interaktywnego: kopiujemy widok, nie
  // funkcje. Bez tego w locie zostają przyciski, w które da się kliknąć,
  // i odnośniki, które łapie tabulacja.
  klon.querySelectorAll('button, a, input').forEach((el) => el.remove());
  klon.setAttribute('aria-hidden', 'true');
  klon.style.cssText = `
    position: fixed;
    left: ${start.left}px;
    top: ${start.top}px;
    width: ${start.width}px;
    height: ${start.height}px;
    margin: 0;
    pointer-events: none;
    z-index: var(--z-toast);
    border-radius: var(--r);
    overflow: hidden;
    will-change: transform, opacity;
  `;
  document.body.appendChild(klon);

  // Środek do środka — lot celujący w róg wygląda, jakby produkt minął koszyk.
  const dx = koniec.left + koniec.width / 2 - (start.left + start.width / 2);
  const dy = koniec.top + koniec.height / 2 - (start.top + start.height / 2);
  // Skala liczona z szerokości celu: paczka ma zniknąć w ikonie, a nie obok niej.
  const skala = Math.max(0.08, koniec.width / start.width);

  const animacja = klon.animate(
    [
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate3d(${dx * 0.5}px, ${dy * 0.5 - 40}px, 0) scale(${(1 + skala) / 2})`,
        opacity: 0.85,
        offset: 0.55,
      },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${skala})`, opacity: 0 },
    ],
    // Łuk w górę w połowie drogi: prosty odcinek czyta się jak przesunięcie
    // pliku, krzywa — jak rzut. Czas na górnej granicy ruchu użytkowego,
    // bo lot ma zdążyć opowiedzieć historię, zanim zniknie.
    { duration: 620, easing: 'cubic-bezier(.3, .0, .2, 1)' }
  );

  animacja.onfinish = () => klon.remove();
  animacja.oncancel = () => klon.remove();
}
