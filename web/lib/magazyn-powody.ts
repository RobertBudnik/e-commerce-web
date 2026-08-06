/**
 * Powody korekty stanu. Lista zamknięta — „inne" po pół roku znaczy tyle
 * co nic, a historia magazynu ma tłumaczyć liczby, nie mnożyć pytania.
 *
 * Osobny plik, nie stała w akcjach: moduł z `'use server'` może eksportować
 * wyłącznie funkcje asynchroniczne. Tablica wystawiona stamtąd przechodzi
 * build i wywala się dopiero przy wejściu na ekran.
 */
export const POWODY_KOREKTY = [
  'Przyjęcie dostawy',
  'Zwrot od klienta',
  'Ubytek lub uszkodzenie',
  'Korekta inwentaryzacyjna',
] as const;

export type PowodKorekty = (typeof POWODY_KOREKTY)[number];
