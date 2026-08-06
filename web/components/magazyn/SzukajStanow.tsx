'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';

/**
 * Pole szukania piszące do adresu, nie do stanu komponentu.
 *
 * Fraza w adresie znaczy, że powrót z korekty stanu wraca do tej samej
 * przefiltrowanej listy, a nie na jej początek — magazynier poprawia
 * zwykle kilka pozycji z tego samego wyniku wyszukiwania.
 *
 * Opóźnienie 300 ms: bez niego każda literа to jedno zapytanie do bazy
 * i przeładowanie listy pod palcem.
 */
export function SzukajStanow({ startowa }: { startowa: string }) {
  const router = useRouter();
  const sciezka = usePathname();
  const parametry = useSearchParams();
  const [fraza, setFraza] = useState(startowa);

  useEffect(() => {
    if (fraza === startowa) return;

    const czasomierz = setTimeout(() => {
      const nowe = new URLSearchParams(parametry.toString());
      if (fraza.trim()) nowe.set('szukaj', fraza.trim());
      else nowe.delete('szukaj');
      router.replace(`${sciezka}?${nowe.toString()}`);
    }, 300);

    return () => clearTimeout(czasomierz);
  }, [fraza, startowa, parametry, router, sciezka]);

  return (
    <label className="mag-szukaj">
      <Icon name="search" />
      <span className="sr-only">Szukaj nazwy lub SKU</span>
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Szukaj nazwy lub SKU"
        value={fraza}
        onChange={(e) => setFraza(e.target.value)}
      />
    </label>
  );
}
