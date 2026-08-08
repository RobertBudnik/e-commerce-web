'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export type OpiniaWynik = { ok: true } | { ok: false; blad: string };

/**
 * Wystawienie opinii.
 *
 * Cała weryfikacja siedzi w `dodaj_opinie()`: że konto kupiło ten produkt
 * i że zamówienie zostało dostarczone. Tutaj odsiewamy tylko oczywiste
 * pomyłki, żeby nie zajmować bazy — przeglądarka nie jest źródłem prawdy
 * o tym, kto co kupił.
 */
export async function dodajOpinieAction(
  produktId: string,
  ocena: number,
  tresc: string,
  slug: string
): Promise<OpiniaWynik> {
  if (!Number.isInteger(ocena) || ocena < 1 || ocena > 5) {
    return { ok: false, blad: 'Wybierz ocenę od jednej do pięciu gwiazdek.' };
  }

  const czysta = tresc.trim();
  if (czysta && czysta.length < 3) {
    return { ok: false, blad: 'Opinia jest za krótka — napisz zdanie albo zostaw samą ocenę.' };
  }
  if (czysta.length > 2000) {
    return { ok: false, blad: 'Opinia jest za długa (maksimum 2000 znaków).' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('dodaj_opinie', {
    p_produkt: produktId,
    p_ocena: ocena,
    p_tresc: czysta || null,
  });

  if (error) return { ok: false, blad: error.message };

  // Ocena produktu zmienia się razem z opinią, więc odświeżamy też listy,
  // które pokazują gwiazdki.
  revalidatePath(`/produkt/${slug}`);
  revalidatePath('/sklep');
  revalidatePath('/');

  return { ok: true };
}
