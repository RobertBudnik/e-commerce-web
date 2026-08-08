'use client';

import Link from 'next/link';
import { useCallback, useRef } from 'react';
import { useEfektKursora, useRuchWylaczony } from '@/lib/ruch';

const PROMIEN = 14; // px — maksymalne dociągnięcie
const SILA = 0.25; // ułamek odległości od środka

/**
 * Główny przycisk: dociąga się do kursora i rozchodzi falą przy kliknięciu.
 *
 * Magnes jest wyłącznie dla myszy — na dotyku nie ma czego śledzić, a próba
 * kończy się przyciskiem, który skacze pod palcem w chwili trafienia.
 *
 * Fala zostaje także przy dotyku: to reakcja na kliknięcie, czyli ruch
 * użytkowy, i jedyne potwierdzenie trafienia w przycisk, który zaraz zabierze
 * użytkownika na inną stronę.
 *
 * Przesunięcie idzie przez zmienne CSS, nie przez `style.transform` wprost —
 * dzięki temu nie kasuje uniesienia i skalowania, które przycisk ma z hovera.
 */
export function PrzyciskMagnetyczny({
  href,
  children,
  className = 'btn',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const kursor = useEfektKursora();
  const bezRuchu = useRuchWylaczony();
  const element = useRef<HTMLAnchorElement>(null);

  const ruch = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!kursor) return;
      const node = element.current;
      if (!node) return;

      const p = node.getBoundingClientRect();
      const dx = e.clientX - (p.left + p.width / 2);
      const dy = e.clientY - (p.top + p.height / 2);

      node.style.setProperty('--magnes-x', `${Math.max(-PROMIEN, Math.min(PROMIEN, dx * SILA))}px`);
      node.style.setProperty('--magnes-y', `${Math.max(-PROMIEN, Math.min(PROMIEN, dy * SILA))}px`);
    },
    [kursor]
  );

  const powrot = useCallback(() => {
    const node = element.current;
    if (!node) return;
    node.style.setProperty('--magnes-x', '0px');
    node.style.setProperty('--magnes-y', '0px');
  }, []);

  const fala = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (bezRuchu) return;
      const node = element.current;
      if (!node) return;

      const p = node.getBoundingClientRect();
      const krag = document.createElement('span');
      krag.className = 'fala';
      krag.style.left = `${e.clientX - p.left}px`;
      krag.style.top = `${e.clientY - p.top}px`;

      // Sprzątanie po animacji, nie po czasomierzu: `animationend` przychodzi
      // także wtedy, gdy przeglądarka animację skróci albo pominie.
      krag.addEventListener('animationend', () => krag.remove(), { once: true });
      node.appendChild(krag);
    },
    [bezRuchu]
  );

  return (
    <Link
      ref={element}
      href={href}
      className={`${className} magnetyczny`}
      onMouseMove={ruch}
      onMouseLeave={powrot}
      onClick={fala}
    >
      <span className="magnetyczny-tresc">{children}</span>
    </Link>
  );
}
