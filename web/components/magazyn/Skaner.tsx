'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { znajdzPoKodzieAction } from '@/app/actions/skan';
import { adjustStockAction } from '@/app/actions/magazyn';
import type { Product } from '@/lib/types';

type Stan =
  | { faza: 'gotowy' }
  | { faza: 'skanuje' }
  | { faza: 'szuka'; kod: string }
  | { faza: 'znaleziony'; kod: string; product: Product; stan: number }
  | { faza: 'brak'; kod: string; komunikat: string }
  | { faza: 'blad'; komunikat: string };

export function Skaner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const czytnikRef = useRef<{ stop: () => void } | null>(null);
  const [stan, setStan] = useState<Stan>({ faza: 'gotowy' });
  const [czekaZapis, setCzekaZapis] = useState(false);

  const zatrzymaj = useCallback(() => {
    czytnikRef.current?.stop();
    czytnikRef.current = null;
    const strumien = videoRef.current?.srcObject as MediaStream | null;
    strumien?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => zatrzymaj, [zatrzymaj]);

  async function start() {
    setStan({ faza: 'skanuje' });
    try {
      // Import leniwy: biblioteka waży ~200 kB i nie ma powodu, żeby ciążyła
      // sklepowi ani pozostałym widokom magazynu.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const czytnik = new BrowserMultiFormatReader();

      const kontrola = await czytnik.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (wynik) => {
          if (!wynik) return;
          const kod = wynik.getText();
          zatrzymaj();
          void szukaj(kod);
        }
      );
      czytnikRef.current = kontrola;
    } catch (e) {
      setStan({
        faza: 'blad',
        komunikat:
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Brak zgody na aparat. Włącz ją w ustawieniach przeglądarki dla tej strony.'
            : 'Nie udało się uruchomić aparatu.',
      });
    }
  }

  async function szukaj(kod: string) {
    setStan({ faza: 'szuka', kod });
    const wynik = await znajdzPoKodzieAction(kod);
    if (wynik.ok) {
      setStan({ faza: 'znaleziony', kod, product: wynik.product, stan: wynik.product.stock });
      // Krótkie potwierdzenie dotykiem — przy hałasie magazynu dźwięku i tak
      // nie słychać, a wzrok jest zajęty kartonem.
      navigator.vibrate?.(40);
    } else {
      setStan({ faza: 'brak', kod, komunikat: wynik.error });
      navigator.vibrate?.([60, 50, 60]);
    }
  }

  function koryguj(delta: number) {
    if (stan.faza !== 'znaleziony') return;
    setCzekaZapis(true);
    const id = stan.product.id;
    void adjustStockAction(id, delta, 'skaner w magazynie').then((w) => {
      setCzekaZapis(false);
      if (w.ok) {
        setStan((s) => (s.faza === 'znaleziony' ? { ...s, stan: w.stock } : s));
        navigator.vibrate?.(25);
      }
    });
  }

  return (
    <div className="skan">
      <div className="skan-okno">
        <video ref={videoRef} playsInline muted />
        {stan.faza === 'skanuje' && <div className="skan-celownik" aria-hidden="true" />}
        {stan.faza !== 'skanuje' && (
          <div className="skan-zaslona">
            <Icon name="search" />
          </div>
        )}
      </div>

      {stan.faza === 'gotowy' && (
        <>
          <p className="skan-info">
            Przyłóż kod kreskowy z opakowania do kadru. Aparat poprosi o zgodę przy
            pierwszym uruchomieniu.
          </p>
          <button type="button" className="btn btn-block skan-cta" onClick={start}>
            Włącz aparat
          </button>
        </>
      )}

      {stan.faza === 'skanuje' && (
        <>
          <p className="skan-info">Szukam kodu w kadrze…</p>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { zatrzymaj(); setStan({ faza: 'gotowy' }); }}>
            Przerwij
          </button>
        </>
      )}

      {stan.faza === 'szuka' && <p className="skan-info num">Sprawdzam {stan.kod}…</p>}

      {stan.faza === 'brak' && (
        <div className="skan-wynik skan-wynik-brak">
          <p className="label">Nieznany kod</p>
          <p className="num skan-kod">{stan.kod}</p>
          <p className="skan-info">{stan.komunikat}</p>
          <p className="skan-info">
            Dopisz go do produktu w panelu na komputerze, wtedy skaner go rozpozna.
          </p>
          <button type="button" className="btn btn-block" onClick={start}>
            Skanuj następny
          </button>
        </div>
      )}

      {stan.faza === 'znaleziony' && (
        <div className="skan-wynik">
          <p className="label">Znaleziono</p>
          <h2 className="skan-nazwa">{stan.product.name}</h2>
          <p className="num skan-kod">{stan.kod}</p>

          <p className="skan-stan num">
            Na stanie: <strong>{stan.stan}</strong>
          </p>

          <div className="skan-korekta">
            <button type="button" onClick={() => koryguj(-1)} disabled={czekaZapis} aria-label="Zdejmij jedną sztukę">
              −1
            </button>
            <button type="button" onClick={() => koryguj(1)} disabled={czekaZapis} aria-label="Dodaj jedną sztukę">
              +1
            </button>
          </div>

          <button type="button" className="btn btn-block" onClick={start}>
            Skanuj następny
          </button>
        </div>
      )}

      {stan.faza === 'blad' && (
        <div className="skan-wynik skan-wynik-brak">
          <p className="skan-info">{stan.komunikat}</p>
          <button type="button" className="btn btn-block" onClick={start}>
            Spróbuj ponownie
          </button>
        </div>
      )}
    </div>
  );
}
