'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { przyjmijZwrotAction } from '@/app/actions/magazyn';

/**
 * Przyjęcie zwrotu jednym dotknięciem.
 *
 * Bez pytania o potwierdzenie: magazynier trzyma paczkę w ręku, a pomyłkę
 * odwraca korekta stanu z powodem „Ubytek lub uszkodzenie". Okienko
 * potwierdzające kosztowałoby dotknięcie przy każdej paczce i nie chroniłoby
 * przed niczym, czego nie da się cofnąć.
 */
export function PrzyjmijZwrot({ zwrotId, sztuk }: { zwrotId: string; sztuk: number }) {
  const router = useRouter();
  const [wToku, setWToku] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function przyjmij() {
    setBlad(null);
    setWToku(true);
    const wynik = await przyjmijZwrotAction(zwrotId);
    setWToku(false);

    if (!wynik.ok) {
      setBlad(wynik.blad);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className="mag-btn" onClick={przyjmij} disabled={wToku}>
        {wToku ? 'Przyjmuję…' : `Przyjmij zwrot · ${sztuk} szt.`}
      </button>
      {blad && <p className="mag-blad">{blad}</p>}
    </>
  );
}
