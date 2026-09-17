import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/queries';
import { ZakladkiZaplecza, type PozycjaZakladki } from '@/components/panel/ZakladkiZaplecza';

export const metadata: Metadata = {
  title: { default: 'Zaplecze', template: '%s · Zaplecze' },
  // Zaplecze nie ma czego szukać w wynikach wyszukiwania. To higiena, nie
  // zabezpieczenie — dostępu pilnują RLS i authorize() w funkcjach.
  robots: { index: false, follow: false },
};

/**
 * Wszystkie zakładki zaplecza w jednej tablicy, z poziomem dostępu przy każdej.
 *
 * Kolejność nie jest alfabetyczna ani „od ważnych do mniej ważnych": praca
 * fizyczna idzie pierwsza, bo `staff` widzi wyłącznie ją i jego pierwszy
 * ekran ma być pierwszy z lewej. Dla zarządcy i właściciela te cztery
 * zakładki są po prostu początkiem dłuższego paska.
 */
const ZAKLADKI: PozycjaZakladki[] = [
  { href: '/panel/kolejka', etykieta: 'Kolejka', grupa: 'zaplecze' },
  { href: '/panel/stany', etykieta: 'Stany', grupa: 'zaplecze' },
  { href: '/panel/zwroty', etykieta: 'Zwroty', grupa: 'zaplecze' },
  { href: '/panel/skan', etykieta: 'Skaner', grupa: 'zaplecze' },

  { href: '/panel', etykieta: 'Pulpit', grupa: 'biuro' },
  { href: '/panel/zamowienia', etykieta: 'Zamówienia', grupa: 'biuro' },
  { href: '/panel/wysylki', etykieta: 'Wysyłki', grupa: 'biuro' },
  { href: '/panel/katalog', etykieta: 'Katalog', grupa: 'biuro' },
  { href: '/panel/finanse', etykieta: 'Finanse', grupa: 'biuro' },

  { href: '/panel/ludzie', etykieta: 'Ludzie', grupa: 'wlasciciel' },
  { href: '/panel/dziennik', etykieta: 'Dziennik', grupa: 'wlasciciel' },
];

/** Te same trzy poziomy co w `panel-dostep.ts` — bramka i pasek muszą mówić to samo. */
const WIDZI: Record<PozycjaZakladki['grupa'], readonly string[]> = {
  zaplecze: ['owner', 'manager', 'staff'],
  biuro: ['owner', 'manager'],
  wlasciciel: ['owner'],
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const rola = user?.rawRole ?? '';

  // Filtr po stronie serwera: przeglądarka nie dostaje nawet nazw ekranów,
  // do których ten człowiek nie ma wstępu.
  const widoczne = ZAKLADKI.filter((z) => WIDZI[z.grupa].includes(rola));

  return (
    <div className="pw">
      <ZakladkiZaplecza pozycje={widoczne} />
      {children}
    </div>
  );
}
