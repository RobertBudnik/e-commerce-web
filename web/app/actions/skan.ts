'use server';

import { getProductByBarcode } from '@/lib/queries';
import type { Product } from '@/lib/types';

export type SkanResult =
  | { ok: true; product: Product }
  | { ok: false; error: string };

/**
 * Odczyt kodu → produkt. Osobna akcja zamiast zapytania z przeglądarki,
 * bo szukanie idzie po kolumnie, której polityka RLS nie wystawia gościom,
 * a token zaplecza siedzi w ciasteczku po stronie serwera.
 */
export async function znajdzPoKodzieAction(barcode: string): Promise<SkanResult> {
  const product = await getProductByBarcode(barcode);
  if (!product) {
    return { ok: false, error: `Kod ${barcode} nie pasuje do żadnego produktu.` };
  }
  return { ok: true, product };
}
