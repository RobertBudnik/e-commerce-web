import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/queries';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s · Panel' },
  // Zaplecze nie ma czego szukać w wynikach wyszukiwania. To higiena, nie
  // zabezpieczenie — dostępu pilnują RLS i authorize() w funkcjach.
  robots: { index: false, follow: false },
};

/** Zakładka „Ludzie" i „Dziennik" tylko dla właściciela — patrz panel-dostep.ts. */
const ZAKLADKI = [
  { href: '/panel', etykieta: 'Pulpit', wlasciciel: false },
  { href: '/panel/zamowienia', etykieta: 'Zamówienia', wlasciciel: false },
  { href: '/panel/wysylki', etykieta: 'Wysyłki', wlasciciel: false },
  { href: '/panel/finanse', etykieta: 'Finanse', wlasciciel: false },
  { href: '/panel/katalog', etykieta: 'Katalog', wlasciciel: false },
  { href: '/panel/ludzie', etykieta: 'Ludzie', wlasciciel: true },
  { href: '/panel/dziennik', etykieta: 'Dziennik', wlasciciel: true },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const wlasciciel = user?.rawRole === 'owner';

  return (
    <div className="pw">
      <nav className="pw-nav container" aria-label="Sekcje panelu">
        {ZAKLADKI.filter((z) => !z.wlasciciel || wlasciciel).map((z) => (
          <Link key={z.href} className="pw-zakladka" href={z.href}>
            {z.etykieta}
          </Link>
        ))}
        <Link className="pw-zakladka pw-zakladka-obok" href="/magazyn">
          Magazyn ↗
        </Link>
      </nav>
      {children}
    </div>
  );
}
