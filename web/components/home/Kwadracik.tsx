'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useEfektKursora, useRuchWylaczony } from '@/lib/ruch';

/**
 * Kwadracik — jedyny element na stronie, który odpowiada na rękę.
 *
 * Trzy warstwy pod jedną perspektywą: tło kadru, znak i podpis. Przy ruchu
 * kursora każda przesuwa się o inny ułamek kąta, więc zamiast płaskiego
 * obrazka widać pudełko z głębią. Kąt jest mały (±9°) — chodzi o to, żeby
 * poczuć bryłę, a nie żeby czytać podpis pod skosem.
 *
 * Kwadracik jest **przełącznikiem, nie ozdobą**: cztery ściany to cztery etapy
 * pracy w pracowni, a kliknięcie przechodzi do następnego. Dlatego pod spodem
 * siedzą prawdziwe przyciski z `aria-selected`, a nie `div` z `onClick` —
 * bez tego rzecz istnieje wyłącznie dla myszy.
 *
 * Trzy tryby, świadomie:
 *
 *   mysz          przechył śledzi kursor, warstwy chodzą paralaksą
 *   dotyk         przechyłu nie ma (nie ma czego śledzić), przełączanie działa
 *   ograniczony   ruch znika w całości, zostaje zmiana treści
 *
 * Wartości kąta idą w zmiennych CSS, nie w `transform` na elemencie: kadr ma
 * już własne przejście przy zmianie ściany i zbiorczy `transform` skasowałby
 * jedno drugim.
 */

const KAT = 9;

type Sciana = {
  klucz: string;
  etykieta: string;
  tytul: string;
  opis: string;
  ikona: string;
};

const SCIANY: readonly Sciana[] = [
  {
    klucz: 'glina',
    etykieta: 'Glina',
    tytul: 'Masa leżakuje trzy tygodnie',
    opis: 'Świeża jest kapryśna przy toczeniu. Odstana robi się posłuszna i mniej pęka przy suszeniu.',
    ikona: 'box',
  },
  {
    klucz: 'kolo',
    etykieta: 'Koło',
    tytul: 'Każda sztuka toczona pojedynczo',
    opis: 'Stąd biorą się różnice na milimetry. Dwie z jednej partii nigdy nie są identyczne.',
    ikona: 'grid',
  },
  {
    klucz: 'piec',
    etykieta: 'Piec',
    tytul: 'Jedenaście godzin i wolne stygnięcie',
    opis: 'Poganiane stygnięcie daje mikropęknięcia w szkliwie. Nauczyliśmy się nie poganiać.',
    ikona: 'shield',
  },
  {
    klucz: 'stol',
    etykieta: 'Stół',
    tytul: 'Sprawdzamy u siebie, zanim wyjedzie',
    opis: 'Zmywarka, gorąca kawa, tydzień codziennego używania. Co nie przejdzie, zostaje w pracowni.',
    ikona: 'heart',
  },
];

export function Kwadracik() {
  const [aktywna, setAktywna] = useState(0);
  const przechylAktywny = useEfektKursora();
  const bezRuchu = useRuchWylaczony();
  const kadr = useRef<HTMLDivElement>(null);

  // Ostatnie położenie kursora i numer zamówionej klatki. Zdarzenie tylko
  // zapisuje liczby; liczy i pisze do stylu wyłącznie `requestAnimationFrame`.
  const kursor = useRef({ x: 0, y: 0 });
  const klatka = useRef<number | null>(null);

  const sciana = SCIANY[aktywna]!;

  useEffect(() => {
    // Zamówiona klatka po odmontowaniu sięgnęłaby po nieistniejący węzeł.
    return () => {
      if (klatka.current !== null) cancelAnimationFrame(klatka.current);
    };
  }, []);

  /**
   * Przechył liczony raz na klatkę, nie raz na zdarzenie.
   *
   * `pointermove` przy myszy 1000 Hz potrafi paść kilkanaście razy między
   * dwiema klatkami, a poprzednia wersja robiła przy każdym z nich
   * `getBoundingClientRect()` — czyli wymuszony reflow. Przeglądarka musiała
   * przeliczyć układ w środku obsługi zdarzenia, tyle razy ile zdarzeń,
   * i stąd brało się klatkowanie przy szybkim ruchu nad bryłą.
   *
   * Teraz zdarzenie zapisuje dwie liczby i wychodzi. Pomiar i zapis do stylu
   * dzieją się w `requestAnimationFrame`, czyli **najwyżej raz na klatkę**.
   * Prostokąt czytany jest w środku klatki, a nie z pamięci — dzięki temu
   * przewinięcie strony pod kursorem nie przesuwa punktu zerowego przechyłu.
   */
  const ruch = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!przechylAktywny) return;

      kursor.current.x = e.clientX;
      kursor.current.y = e.clientY;

      if (klatka.current !== null) return;
      klatka.current = requestAnimationFrame(() => {
        klatka.current = null;

        const wezel = kadr.current;
        if (!wezel) return;

        const p = wezel.getBoundingClientRect();
        if (p.width === 0 || p.height === 0) return;

        // Od -0,5 do 0,5 w obu osiach, licząc od środka kadru.
        const x = (kursor.current.x - p.left) / p.width - 0.5;
        const y = (kursor.current.y - p.top) / p.height - 0.5;

        wezel.style.setProperty('--kw-x', `${(x * KAT).toFixed(2)}deg`);
        wezel.style.setProperty('--kw-y', `${(-y * KAT).toFixed(2)}deg`);
        // Paralaksa warstw: przesunięcie w tę samą stronę co przechył, ale
        // w pikselach i słabsze, żeby warstwy nie odklejały się od kadru.
        wezel.style.setProperty('--kw-px', `${(x * 14).toFixed(1)}px`);
        wezel.style.setProperty('--kw-py', `${(y * 14).toFixed(1)}px`);
      });
    },
    [przechylAktywny]
  );

  const wyjscie = useCallback(() => {
    // Klatka zamówiona tuż przed wyjściem ustawiłaby przechył po powrocie
    // do zera, więc kasujemy ją razem ze zmiennymi.
    if (klatka.current !== null) {
      cancelAnimationFrame(klatka.current);
      klatka.current = null;
    }

    const wezel = kadr.current;
    if (!wezel) return;
    for (const zmienna of ['--kw-x', '--kw-y', '--kw-px', '--kw-py']) {
      wezel.style.removeProperty(zmienna);
    }
  }, []);

  const nastepna = useCallback(() => {
    setAktywna((i) => (i + 1) % SCIANY.length);
  }, []);

  return (
    <div className="kw">
      <div
        className="kw-scena"
        ref={kadr}
        onPointerMove={ruch}
        onPointerLeave={wyjscie}
        data-bez-ruchu={bezRuchu ? '' : undefined}
      >
        {/* Cała bryła jest klikalna, ale to przycisk, nie div: dostaje fokus,
            reaguje na spację i mówi czytnikowi, co robi. */}
        <button
          type="button"
          className="kw-bryla"
          onClick={nastepna}
          aria-label={`${sciana.tytul}. Pokaż następny etap pracy.`}
        >
          <span className="kw-warstwa kw-tlo" aria-hidden="true" />
          <span className="kw-warstwa kw-znak" aria-hidden="true">
            <Icon name={sciana.ikona} />
          </span>
          <span className="kw-warstwa kw-tresc">
            <span className="kw-numer">
              {String(aktywna + 1).padStart(2, '0')} / {String(SCIANY.length).padStart(2, '0')}
            </span>
            <strong className="kw-tytul">{sciana.tytul}</strong>
            <span className="kw-opis">{sciana.opis}</span>
          </span>
        </button>
      </div>

      {/* Zakładki pod kadrem. Klikanie w bryłę jest wygodne, ale niewidoczne —
          bez tego paska nikt nie wie, że da się przełączyć, ani że etapów
          jest cztery. */}
      <div className="kw-zakladki" role="tablist" aria-label="Etapy pracy w pracowni">
        {SCIANY.map((s, i) => (
          <button
            key={s.klucz}
            type="button"
            role="tab"
            className="kw-zakladka"
            aria-selected={i === aktywna}
            onClick={() => setAktywna(i)}
          >
            {s.etykieta}
          </button>
        ))}
      </div>
    </div>
  );
}
