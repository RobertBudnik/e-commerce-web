'use client';

import Image from 'next/image';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import {
  dodajZdjecieGaleriiAction,
  galeriaProduktuAction,
  usunZdjecieGaleriiAction,
  type ZdjeciePanelu,
} from '@/app/actions/catalog';
import { toast } from '@/components/ui/ToastHost';

/**
 * Zdjęcia dodatkowe produktu — te, które karta pokazuje pod okładką.
 *
 * Osobny blok, nie kolejne pole formularza produktu, bo rządzi się inną
 * logiką: dodaje się je pojedynczo, od razu, i tylko przy produkcie, który
 * już istnieje. Nowy produkt nie ma jeszcze identyfikatora, do którego można
 * przypiąć plik, więc blok pojawia się dopiero po pierwszym zapisie.
 */
export function GaleriaPanelu({ productId }: { productId: string }) {
  const [zdjecia, setZdjecia] = useState<ZdjeciePanelu[]>([]);
  const [wczytane, setWczytane] = useState(false);
  const [zajete, start] = useTransition();

  useEffect(() => {
    let anulowane = false;
    setWczytane(false);

    galeriaProduktuAction(productId).then((lista) => {
      if (anulowane) return;
      setZdjecia(lista);
      setWczytane(true);
    });

    return () => {
      anulowane = true;
    };
  }, [productId]);

  function dodaj(e: React.ChangeEvent<HTMLInputElement>) {
    const plik = e.target.files?.[0];
    if (!plik) return;

    const dane = new FormData();
    dane.set('zdjecie', plik);
    // Pole czyścimy od razu: bez tego wybranie tego samego pliku drugi raz
    // nie odpala zdarzenia i wygląda, jakby przycisk przestał działać.
    e.target.value = '';

    start(async () => {
      const wynik = await dodajZdjecieGaleriiAction(productId, dane);
      if (!wynik.ok) {
        toast(wynik.error);
        return;
      }
      setZdjecia(await galeriaProduktuAction(productId));
      toast('Zdjęcie dodane');
    });
  }

  function usun(zdjecie: ZdjeciePanelu) {
    start(async () => {
      const wynik = await usunZdjecieGaleriiAction(zdjecie.id, zdjecie.path);
      if (!wynik.ok) {
        toast(wynik.error);
        return;
      }
      setZdjecia((poprzednie) => poprzednie.filter((z) => z.id !== zdjecie.id));
      toast('Zdjęcie usunięte');
    });
  }

  return (
    <div className="field">
      <label htmlFor="a-galeria">Zdjęcia dodatkowe</label>

      <div className="galeria-panel">
        {wczytane && zdjecia.length === 0 && (
          <p className="field-hint" style={{ margin: 0 }}>
            Karta produktu pokazuje wtedy samą okładkę.
          </p>
        )}

        {zdjecia.length > 0 && (
          <ul className="galeria-panel-lista">
            {zdjecia.map((z, i) => (
              <li key={z.id}>
                <span className="galeria-panel-kadr">
                  <Image src={z.url} alt="" fill sizes="72px" unoptimized />
                </span>
                <button
                  type="button"
                  className="galeria-panel-usun"
                  disabled={zajete}
                  aria-label={`Usuń ujęcie ${i + 1}`}
                  onClick={() => usun(z)}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          id="a-galeria"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={zajete}
          onChange={dodaj}
        />
        <p className="field-hint">
          Kolejność taka jak dodawania. Do 5 MB na plik — tyle przyjmuje kubełek.
        </p>
      </div>
    </div>
  );
}
