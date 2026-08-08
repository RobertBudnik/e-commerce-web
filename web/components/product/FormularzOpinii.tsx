'use client';

import { useState, useTransition } from 'react';
import { dodajOpinieAction } from '@/app/actions/opinie';
import { toast } from '@/components/ui/ToastHost';

const OCENY = [1, 2, 3, 4, 5];

/**
 * Wystawienie oceny na karcie produktu.
 *
 * Formularz pokazuje się wyłącznie kontu, które ten produkt kupiło i odebrało —
 * decyduje o tym serwer. To jest wygoda, nie zapora: `dodaj_opinie()` sprawdza
 * zakup po swojej stronie i odmawia niezależnie od tego, co pokaże interfejs.
 *
 * Gwiazdki są przyciskami radiowymi w `fieldset`, nie własną listą wyboru:
 * ocena to wybór jednej wartości z pięciu, czyli dokładnie to, do czego
 * przeglądarka ma gotową kontrolkę z obsługą strzałek i czytnika ekranu.
 */
export function FormularzOpinii({
  produktId,
  slug,
  mojaOcena,
}: {
  produktId: string;
  slug: string;
  /** Ocena wystawiona wcześniej — formularz otwiera się wtedy jako poprawka. */
  mojaOcena?: number;
}) {
  const [ocena, setOcena] = useState(mojaOcena ?? 0);
  const [tresc, setTresc] = useState('');
  const [wysylam, start] = useTransition();

  function wyslij(e: React.FormEvent) {
    e.preventDefault();
    if (!ocena) {
      toast('Wybierz ocenę');
      return;
    }

    start(async () => {
      const wynik = await dodajOpinieAction(produktId, ocena, tresc, slug);
      if (!wynik.ok) {
        toast(wynik.blad);
        return;
      }
      setTresc('');
      toast(mojaOcena ? 'Opinia poprawiona' : 'Dziękujemy za opinię');
    });
  }

  return (
    <form className="opinia-form" onSubmit={wyslij}>
      <fieldset className="opinia-oceny">
        <legend className="label">{mojaOcena ? 'Popraw swoją ocenę' : 'Twoja ocena'}</legend>
        {OCENY.map((n) => (
          <label key={n} className="opinia-gwiazdka">
            <input
              type="radio"
              name="ocena"
              value={n}
              checked={ocena === n}
              onChange={() => setOcena(n)}
            />
            <span aria-hidden="true">{n <= ocena ? '★' : '☆'}</span>
            <span className="sr-only">
              {n} {n === 1 ? 'gwiazdka' : n < 5 ? 'gwiazdki' : 'gwiazdek'}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="opinia-tresc">Twoimi słowami (opcjonalnie)</label>
        <textarea
          id="opinia-tresc"
          rows={3}
          maxLength={2000}
          placeholder="Co się sprawdziło, a co nie?"
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
        />
      </div>

      <button className="btn" type="submit" disabled={wysylam || !ocena}>
        {wysylam ? 'Zapisuję…' : mojaOcena ? 'Popraw opinię' : 'Wystaw opinię'}
      </button>
    </form>
  );
}
