'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useRuchWylaczony } from '@/lib/ruch';

export type Krok = { nadtytul: string; tytul: string; opis: string; ikona: string };

/**
 * Sekcja, która przykleja się na czas przewijania i zmienia treść w krokach.
 *
 * Wysokość zewnętrznego bloku to `kroki.length × 100vh` — to ona daje drogę,
 * na której sekcja ma zostać przyklejona. Wewnętrzny blok jest `sticky` i to
 * on stoi; postęp liczymy z tego, ile z drogi już przewinięto.
 *
 * Bez `prefers-reduced-motion` sekcja przestaje być przypięta i wszystkie
 * kroki lądują pod sobą jako zwykła lista. To ważniejsze niż wyłączenie samej
 * animacji: przyklejanie porywa kontrolę nad przewijaniem, a to jest dokładnie
 * to, czego ustawienie „ogranicz ruch" ma unikać.
 *
 * Pomiar w `requestAnimationFrame`, nie w samym `scroll`: zdarzenie
 * przewijania potrafi przyjść kilka razy między klatkami, a `getBoundingClientRect`
 * w każdym z nich to wymuszony przeliczony układ.
 */
export function SekcjaPrzypieta({ kroki }: { kroki: Krok[] }) {
  const bezRuchu = useRuchWylaczony();
  const blok = useRef<HTMLDivElement>(null);
  const [aktywny, setAktywny] = useState(0);

  useEffect(() => {
    if (bezRuchu) return;
    const node = blok.current;
    if (!node) return;

    let ramka = 0;
    let czeka = false;

    const zmierz = () => {
      czeka = false;
      const p = node.getBoundingClientRect();
      const droga = p.height - window.innerHeight;
      if (droga <= 0) return;

      const postep = Math.min(1, Math.max(0, -p.top / droga));
      // `min` z ostatnim indeksem, bo przy postępie równym 1 mnożenie daje
      // indeks poza tablicą.
      setAktywny(Math.min(kroki.length - 1, Math.floor(postep * kroki.length)));
    };

    const naScroll = () => {
      if (czeka) return;
      czeka = true;
      ramka = requestAnimationFrame(zmierz);
    };

    zmierz();
    window.addEventListener('scroll', naScroll, { passive: true });
    window.addEventListener('resize', naScroll);

    return () => {
      cancelAnimationFrame(ramka);
      window.removeEventListener('scroll', naScroll);
      window.removeEventListener('resize', naScroll);
    };
  }, [bezRuchu, kroki.length]);

  // Bez ruchu: zwykła lista, bez przyklejania i bez przejmowania przewijania.
  if (bezRuchu) {
    return (
      <section className="section container przypieta-lista">
        {kroki.map((k) => (
          <div className="przypieta-krok" key={k.tytul}>
            <span className="label">{k.nadtytul}</span>
            <h3>{k.tytul}</h3>
            <p className="lede">{k.opis}</p>
          </div>
        ))}
      </section>
    );
  }

  const krok = kroki[aktywny];

  return (
    <div className="przypieta" ref={blok} style={{ height: `${kroki.length * 100}vh` }}>
      <div className="przypieta-ekran">
        <div className="container przypieta-tresc">
          <div className="przypieta-media" aria-hidden="true">
            {/* Klucz na kroku: bez niego ikona podmienia się w tym samym
                elemencie i wejście nie ma czego animować. */}
            <span key={krok.ikona} className="przypieta-ikona">
              <Icon name={krok.ikona} />
            </span>
          </div>

          <div className="przypieta-opis">
            <span className="label">{krok.nadtytul}</span>
            {/* Nagłówek i opis też dostają klucz — treść ma wjechać, a nie
                podmienić się w miejscu. */}
            <h3 key={`${krok.tytul}-t`}>{krok.tytul}</h3>
            <p className="lede" key={`${krok.tytul}-o`}>
              {krok.opis}
            </p>

            <ol className="przypieta-kropki">
              {kroki.map((k, i) => (
                <li key={k.tytul} aria-current={i === aktywny ? 'step' : undefined}>
                  <span className="sr-only">
                    {i + 1}. {k.tytul}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
