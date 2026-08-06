'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  /** Wywoływane raz, przy pierwszym udanym odczycie. */
  naKod: (kod: string) => void;
  naBlad: (komunikat: string) => void;
};

/**
 * Kadr czytający kod kreskowy. Wyciągnięty z zakładki Skaner, bo ten sam
 * odczyt jest potrzebny przy numerze listu przewozowego — etykieta kuriera
 * niesie kod kreskowy tak samo jak opakowanie produktu.
 *
 * Komponent nie decyduje, co zrobić z odczytem: oddaje kod i gasi kamerę.
 * Dzięki temu skaner magazynu i arkusz nadania mogą go użyć bez dzielenia
 * się stanem, którego drugi z nich nie potrzebuje.
 */
export function OdczytKodu({ naKod, naBlad }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const czytnikRef = useRef<{ stop: () => void } | null>(null);
  const oddanyRef = useRef(false);
  const [dziala, setDziala] = useState(false);

  const zatrzymaj = useCallback(() => {
    czytnikRef.current?.stop();
    czytnikRef.current = null;
    const strumien = videoRef.current?.srcObject as MediaStream | null;
    strumien?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let porzucony = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const czytnik = new BrowserMultiFormatReader();

        const kontrola = await czytnik.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (wynik) => {
            // Czytnik woła przy każdej klatce z trafieniem; interesuje nas
            // pierwsze, inaczej pole numeru przepisywałoby się w kółko.
            if (!wynik || oddanyRef.current) return;
            oddanyRef.current = true;
            zatrzymaj();
            naKod(wynik.getText());
          }
        );

        if (porzucony) {
          kontrola.stop();
          return;
        }
        czytnikRef.current = kontrola;
        setDziala(true);
      } catch (e) {
        naBlad(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Brak zgody na aparat. Włącz ją w Ustawieniach iPhone’a: Nordo → Aparat.'
            : 'Nie udało się uruchomić aparatu.'
        );
      }
    })();

    return () => {
      porzucony = true;
      zatrzymaj();
    };
  }, [naKod, naBlad, zatrzymaj]);

  return (
    <div className="mag-kadr mag-sheet-kadr">
      <video ref={videoRef} playsInline muted />
      {dziala && (
        <>
          <div className="mag-klamry" aria-hidden="true" />
          <div className="mag-klamry-b" aria-hidden="true" />
          <div className="mag-linia" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
