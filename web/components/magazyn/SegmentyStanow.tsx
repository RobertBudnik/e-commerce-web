'use client';

import Link from 'next/link';
import { PlamaWyboru } from '@/components/ruch/PlamaWyboru';

/**
 * Pasek segmentów nad listą stanów: Wszystko · Niskie · Zero.
 *
 * Wyciągnięty ze strony do komponentu klienckiego wyłącznie po to, żeby
 * wypełnienie aktywnego segmentu mogło mieć wspólny `layoutId` — plama
 * przejeżdża wtedy wzdłuż paska zamiast gasnąć tu i zapalać się tam.
 * To ten sam mechanizm, co przy filtrach katalogu i zakładkach konta.
 *
 * Adresy przychodzą gotowe z serwera. Budowanie ich tutaj oznaczałoby
 * powtórzenie logiki `searchParams` po stronie klienta, a to jedyne miejsce,
 * gdzie łatwo o rozjazd: pasek pokazywałby inny filtr, niż faktycznie jest
 * w adresie.
 */
export type Segment = {
  klucz: string;
  etykieta: string;
  href: string;
  licznik?: number;
};

export function SegmentyStanow({
  segmenty,
  aktywny,
}: {
  segmenty: Segment[];
  aktywny: string;
}) {
  return (
    <div className="mag-segmenty" role="tablist" aria-label="Filtr stanów">
      {segmenty.map((s) => (
        <Link
          key={s.klucz}
          className="mag-segment"
          role="tab"
          aria-selected={s.klucz === aktywny}
          href={s.href}
        >
          {s.klucz === aktywny && (
            <PlamaWyboru layoutId="mag-segment-plama" className="mag-segment-tlo" />
          )}
          <span className="mag-segment-tekst">
            {s.etykieta}
            {s.licznik !== undefined && (
              <span className="mag-segment-licznik">{s.licznik}</span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
