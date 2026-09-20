import { NextResponse } from 'next/server';
import { getSessionUser, getZamowieniaPanelu } from '@/lib/queries';

/**
 * Eksport sprzedaży do CSV — dla księgowej.
 *
 * Plik składa się po stronie serwera i wychodzi jako pobranie. Trzy rzeczy,
 * które decydują o tym, czy da się go otworzyć w Polsce:
 *
 *   separator `;`   Excel z polskim ustawieniem regionu dzieli po średniku,
 *                   po przecinku wrzuca cały wiersz do jednej komórki
 *   BOM na starcie  bez niego Excel czyta UTF-8 jako Windows-1250 i „ł" znika
 *   przecinek dziesiętny w kwotach — inaczej arkusz widzi tekst, nie liczbę
 *
 * Bez kolumn z nazwiskiem i adresem: raport dla księgowości potrzebuje kwot
 * i numerów dokumentów, nie danych osobowych klientów.
 */

const KOLUMNY = [
  'numer',
  'data',
  'stan',
  'platnosc',
  'wartosc_brutto_pln',
  'dostawa_pln',
  'rabat_pln',
  'pozycji',
];

const kwota = (n: number) => n.toFixed(2).replace('.', ',');

/** Pole CSV: cudzysłowy podwajamy, całość w cudzysłowie, gdy trzeba. */
function pole(wartosc: string): string {
  return /[";\n]/.test(wartosc) ? `"${wartosc.replace(/"/g, '""')}"` : wartosc;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  // Bramka dla porządku; o danych i tak decyduje RLS — konto bez uprawnień
  // dostanie z bazy pustą listę, nie cudze zamówienia.
  if (!user || !['owner', 'manager'].includes(user.rawRole)) {
    return new NextResponse('Brak dostępu', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dni = Math.min(366, Math.max(1, Number(searchParams.get('zakres') ?? 30) || 30));
  const od = new Date(Date.now() - dni * 86_400_000).toISOString().slice(0, 10);

  const zamowienia = await getZamowieniaPanelu({ od, platnosc: 'opłacone' });

  const wiersze = zamowienia
    .filter((z) => z.status !== 'anulowane')
    .map((z) =>
      [
        z.number,
        z.date.slice(0, 10),
        z.status,
        z.paymentStatus,
        kwota(z.total),
        kwota(z.shipping),
        kwota(z.discount),
        String(z.items.reduce((s, p) => s + p.qty, 0)),
      ]
        .map(pole)
        .join(';')
    );

  const csv = `﻿${KOLUMNY.join(';')}\n${wiersze.join('\n')}\n`;
  const nazwa = `sprzedaz-${od}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nazwa}"`,
      'Cache-Control': 'no-store',
    },
  });
}
