'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { korygujStanAction } from '@/app/actions/magazyn';
import { znajdzPoKodzieAction } from '@/app/actions/skan';
import type { Product } from '@/lib/types';

type Stan =
  | { faza: 'gotowy' }
  | { faza: 'skanuje' }
  | { faza: 'szuka'; kod: string }
  | { faza: 'znaleziony'; kod: string; produkt: Product; stan: number }
  | { faza: 'nieznany'; kod: string }
  | { faza: 'brak-zgody' }
  | { faza: 'blad'; komunikat: string };

/**
 * Powód dla korekty ze skanera.
 *
 * Skanowanie regału i poprawianie po jednej sztuce to liczenie towaru,
 * a nie przyjęcie dostawy ani ubytek — z zamkniętej listy powodów pasuje
 * dokładnie jeden i nie zgadujemy za magazyniera.
 */
const POWOD_SKANERA = 'Korekta inwentaryzacyjna';

/**
 * Ścieżka do zgody na aparat zależy od tego, gdzie widok jest oglądany.
 * W powłoce na iPhonie nie ma żadnych „ustawień przeglądarki" — odesłanie
 * tam zostawia magazyniera z instrukcją, której nie da się wykonać.
 */
function instrukcjaZgody(): string {
  const wPowloce =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('w-aplikacji');

  return wPowloce
    ? 'Włącz aparat w Ustawieniach iPhone’a: Nordo → Aparat.'
    : 'Włącz aparat w ustawieniach przeglądarki dla tej strony.';
}

export function Skaner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const czytnikRef = useRef<{ stop: () => void } | null>(null);
  const [stan, setStan] = useState<Stan>({ faza: 'gotowy' });
  const [zapis, setZapis] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const zatrzymaj = useCallback(() => {
    czytnikRef.current?.stop();
    czytnikRef.current = null;
    const strumien = videoRef.current?.srcObject as MediaStream | null;
    strumien?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => zatrzymaj, [zatrzymaj]);

  async function start() {
    setBlad(null);
    setStan({ faza: 'skanuje' });
    try {
      // Import leniwy: biblioteka waży ~200 kB i nie ma powodu, żeby ciążyła
      // sklepowi ani pozostałym widokom magazynu.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const czytnik = new BrowserMultiFormatReader();

      czytnikRef.current = await czytnik.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (wynik) => {
          if (!wynik) return;
          const kod = wynik.getText();
          zatrzymaj();
          void szukaj(kod);
        }
      );
    } catch (e) {
      setStan(
        e instanceof Error && e.name === 'NotAllowedError'
          ? { faza: 'brak-zgody' }
          : { faza: 'blad', komunikat: 'Nie udało się uruchomić aparatu.' }
      );
    }
  }

  async function szukaj(kod: string) {
    setStan({ faza: 'szuka', kod });
    const wynik = await znajdzPoKodzieAction(kod);

    if (wynik.ok) {
      setStan({ faza: 'znaleziony', kod, produkt: wynik.product, stan: wynik.product.stock });
      // Krótkie potwierdzenie dotykiem — przy hałasie magazynu dźwięku i tak
      // nie słychać, a wzrok jest zajęty kartonem.
      navigator.vibrate?.(40);
    } else {
      setStan({ faza: 'nieznany', kod });
      navigator.vibrate?.([60, 50, 60]);
    }
  }

  async function koryguj(delta: number) {
    if (stan.faza !== 'znaleziony') return;
    setBlad(null);
    setZapis(true);

    const wynik = await korygujStanAction(
      stan.produkt.id,
      delta,
      POWOD_SKANERA,
      '',
      // Każde dotknięcie to świadoma osobna korekta o jedną sztukę, więc
      // każde dostaje własny klucz. Idempotencji pilnuje tu blokada wiersza
      // w bazie, nie powtarzalność żądania.
      crypto.randomUUID()
    );
    setZapis(false);

    if (!wynik.ok) {
      // Po błędzie liczba wraca do stanu z bazy — inaczej magazynier patrzy
      // na wartość, której nigdzie nie ma.
      setStan({ ...stan, stan: stan.produkt.stock });
      setBlad(wynik.blad);
      return;
    }

    setStan({ ...stan, stan: wynik.stan });
    navigator.vibrate?.(25);
  }

  const skanuje = stan.faza === 'skanuje';

  return (
    <div className="mag-skan">
      <div className="mag-kadr">
        <video ref={videoRef} playsInline muted />
        {skanuje && (
          <>
            <div className="mag-klamry" aria-hidden="true" />
            <div className="mag-klamry-b" aria-hidden="true" />
            <div className="mag-linia" aria-hidden="true" />
          </>
        )}
      </div>

      {stan.faza === 'gotowy' && (
        <>
          <p className="mag-podpowiedz">ustaw kod EAN w kadrze</p>
          <div className="mag-akcje">
            <button type="button" className="mag-btn" onClick={start}>
              Włącz aparat
            </button>
          </div>
        </>
      )}

      {skanuje && (
        <>
          <p className="mag-podpowiedz">ustaw kod EAN w kadrze</p>
          <div className="mag-akcje">
            <button
              type="button"
              className="mag-btn mag-btn-link"
              onClick={() => {
                zatrzymaj();
                setStan({ faza: 'gotowy' });
              }}
            >
              Przerwij
            </button>
          </div>
        </>
      )}

      {stan.faza === 'szuka' && <p className="mag-podpowiedz">sprawdzam {stan.kod}…</p>}

      {stan.faza === 'znaleziony' && (
        <div className="mag-arkusz">
          <div className="mag-arkusz-gora">
            <span
              className={`mag-dioda${
                stan.stan === 0
                  ? ' mag-dioda-zero'
                  : stan.produkt.progNiski > 0 && stan.stan <= stan.produkt.progNiski
                    ? ' mag-dioda-uwaga'
                    : ''
              }`}
              aria-hidden="true"
            />
            <h2 className="mag-arkusz-nazwa">{stan.produkt.name}</h2>
          </div>

          <p className="mag-arkusz-kod">
            {[stan.kod, stan.produkt.sku].filter(Boolean).join(' · ')}
          </p>

          <p className="mag-arkusz-stan" aria-live="polite">
            {stan.stan} szt.
          </p>

          <div className="mag-arkusz-akcje">
            <button
              type="button"
              className="mag-btn mag-btn-obrys"
              onClick={() => koryguj(-1)}
              disabled={zapis}
              aria-label="Zdejmij jedną sztukę"
            >
              −1
            </button>
            <button
              type="button"
              className="mag-btn"
              onClick={() => koryguj(1)}
              disabled={zapis}
              aria-label="Dodaj jedną sztukę"
            >
              +1
            </button>
          </div>

          {blad && <p className="mag-blad" style={{ marginTop: 10 }}>{blad}</p>}

          <Link className="mag-btn mag-btn-link" href={`/magazyn/stany/${stan.produkt.id}`}>
            Otwórz kartę produktu
          </Link>

          <button type="button" className="mag-btn mag-btn-link" onClick={start}>
            Skanuj następny
          </button>
        </div>
      )}

      {stan.faza === 'nieznany' && (
        <div className="mag-arkusz">
          <h2 className="mag-arkusz-nazwa">Nie znam tego kodu</h2>
          {/* Kod musi dać się skopiować — w powłoce zaznaczanie jest wyłączone
              wszędzie poza takimi miejscami. */}
          <p className="mag-arkusz-kod" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
            {stan.kod}
          </p>

          {/* Przypisanie kodu to edycja produktu, a ta mieszka w panelu.
              Aplikacja prowadzi tam zamiast udawać, że zrobi to sama. */}
          <Link className="mag-btn" href="/panel" style={{ marginTop: 12 }}>
            Przypisz do produktu
          </Link>

          <button type="button" className="mag-btn mag-btn-link" onClick={start}>
            Skanuj następny
          </button>
        </div>
      )}

      {stan.faza === 'brak-zgody' && (
        <div className="mag-arkusz">
          <h2 className="mag-arkusz-nazwa">Brak zgody na aparat</h2>
          <p className="mag-arkusz-kod">{instrukcjaZgody()}</p>

          <button type="button" className="mag-btn" style={{ marginTop: 12 }} onClick={start}>
            Spróbuj ponownie
          </button>
          {/* Bez aparatu skaner jest ślepy, ale magazyn działa dalej —
              wyjście stąd musi istnieć, inaczej zostaje czarny prostokąt. */}
          <Link className="mag-btn mag-btn-link" href="/magazyn/stany">
            Przejdź do listy magazynu
          </Link>
        </div>
      )}

      {stan.faza === 'blad' && (
        <div className="mag-arkusz">
          <h2 className="mag-arkusz-nazwa">Aparat nie ruszył</h2>
          <p className="mag-arkusz-kod">{stan.komunikat}</p>
          <button type="button" className="mag-btn" style={{ marginTop: 12 }} onClick={start}>
            Spróbuj ponownie
          </button>
          <Link className="mag-btn mag-btn-link" href="/magazyn/stany">
            Przejdź do listy magazynu
          </Link>
        </div>
      )}
    </div>
  );
}
