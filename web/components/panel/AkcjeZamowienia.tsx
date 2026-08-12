'use client';

import { useState, useTransition } from 'react';
import { nadajPaczkeAction, potwierdzDoreczenieAction, ustawStanAction } from '@/app/actions/panel';

/**
 * Akcje przy zamówieniu: kolejka pakowania i nadanie paczki.
 *
 * Listy statusów do wyboru tu nie ma. Wysyłkę stawia nadanie — razem z numerem
 * listu, bo paczka bez listu nie jest wysłana. Doręczenie ma własny przycisk,
 * nie pozycję na liście: to potwierdzenie faktu spoza sklepu, więc baza
 * zapisuje przy nim źródło („obsługa" kontra odczyt od przewoźnika) i widać
 * później, czy stan przyszedł z sieci, czy ktoś go postawił z ręki.
 *
 * Błąd z bazy pokazujemy dosłownie. „Zamówienie jest anulowane — towar wrócił
 * na magazyn" mówi wszystko; „nie udało się" nie mówi nic.
 */
export function AkcjeZamowienia({
  zamowienieId,
  stan,
  numerPrzesylki,
  punktOdbioru,
}: {
  zamowienieId: string;
  stan: string;
  numerPrzesylki: string | null;
  punktOdbioru: string | null;
}) {
  const [numer, setNumer] = useState('');
  const [przewoznik, setPrzewoznik] = useState<'inpost' | 'inny'>(punktOdbioru ? 'inpost' : 'inny');
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [czekam, start] = useTransition();

  function przestaw(nowy: 'nowe' | 'spakowane') {
    setBlad(null);
    setKomunikat(null);
    start(async () => {
      const wynik = await ustawStanAction(zamowienieId, nowy);
      if (wynik.ok) setKomunikat(`Stan: ${wynik.dane}`);
      else setBlad(wynik.blad);
    });
  }

  function potwierdz() {
    setBlad(null);
    setKomunikat(null);
    start(async () => {
      const wynik = await potwierdzDoreczenieAction(zamowienieId);
      if (wynik.ok) setKomunikat('Oznaczono jako doręczone — zapisane jako potwierdzenie obsługi');
      else setBlad(wynik.blad);
    });
  }

  function nadaj() {
    setBlad(null);
    setKomunikat(null);
    start(async () => {
      const wynik = await nadajPaczkeAction(zamowienieId, numer, przewoznik, punktOdbioru);
      if (wynik.ok) setKomunikat(`Nadano: ${wynik.dane}`);
      else setBlad(wynik.blad);
    });
  }

  return (
    <div className="pw-akcje">
      {stan !== 'anulowane' && !numerPrzesylki && (
        <div className="pw-akcje-rzad">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={czekam || stan === 'nowe'}
            onClick={() => przestaw('nowe')}
          >
            Cofnij do nowych
          </button>
          <button
            className="btn"
            type="button"
            disabled={czekam || stan === 'spakowane'}
            onClick={() => przestaw('spakowane')}
          >
            Spakowane
          </button>
        </div>
      )}

      {numerPrzesylki ? (
        <p className="muted">
          Paczka nadana — list <span className="num">{numerPrzesylki}</span>. Numer nadaje się raz;
          zmiana wymaga anulowania przesyłki u przewoźnika.
        </p>
      ) : (
        <div className="pw-akcje-rzad">
          <label className="pw-pole">
            <span className="label">Przewoźnik</span>
            <select
              className="pw-input"
              value={przewoznik}
              onChange={(e) => setPrzewoznik(e.target.value as 'inpost' | 'inny')}
            >
              <option value="inpost">InPost</option>
              <option value="inny">inny</option>
            </select>
          </label>

          <label className="pw-pole pw-pole-szerokie">
            <span className="label">Numer listu przewozowego</span>
            <input
              className="pw-input num"
              value={numer}
              onChange={(e) => setNumer(e.target.value)}
              placeholder="wklej z panelu przewoźnika"
            />
          </label>

          <button className="btn" type="button" disabled={czekam || !numer.trim()} onClick={nadaj}>
            {czekam ? 'Zapisuję…' : 'Nadaj paczkę'}
          </button>
        </div>
      )}

      {stan !== 'dostarczone' && stan !== 'anulowane' && (
        <div className="pw-akcje-rzad">
          <button className="btn btn-ghost" type="button" disabled={czekam} onClick={potwierdz}>
            Potwierdź doręczenie
          </button>
          <span className="muted">
            Dla paczek, których przewoźnik nie potwierdził, a klient odebrał. Zapisuje się
            w dzienniku jako potwierdzenie obsługi, nie odczyt z sieci.
          </span>
        </div>
      )}

      {komunikat && (
        <p className="pw-komunikat" role="status">
          {komunikat}
        </p>
      )}
      {blad && (
        <p className="pw-blad" role="status">
          {blad}
        </p>
      )}
    </div>
  );
}
