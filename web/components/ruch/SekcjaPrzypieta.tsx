'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
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
 * Postęp liczy `useScroll` z Motion, nie własny nasłuch przewijania. Wcześniej
 * stał tu `getBoundingClientRect` w `requestAnimationFrame` — działało, ale
 * każdy pomiar wymuszał przeliczenie układu, a przy dwóch takich sekcjach na
 * stronie robiły się z tego dwa niezależne nasłuchy scrolla. Motion mierzy raz,
 * dla wszystkich, i oddaje gotowy ułamek drogi.
 */
export function SekcjaPrzypieta({ kroki }: { kroki: Krok[] }) {
  const bezRuchu = useRuchWylaczony();
  const blok = useRef<HTMLDivElement>(null);
  const [aktywny, setAktywny] = useState(0);

  // `start start` → `end end`: zero, gdy górna krawędź bloku dotyka górnej
  // krawędzi okna, jedynka, gdy dolna dotyka dolnej. Dokładnie ta droga,
  // na której sekcja jest przyklejona.
  // Strumień przewijania bierzemy z Motion, ale bez `target`. Wariant z celem
  // mierzy element w `useLayoutEffect` — czyli zanim React nawiąże połączenie
  // z HTML-em przysłanym przez serwer — i przewraca się na
  // „Target ref is defined but not hydrated", zostawiając postęp na zerze.
  // Wersji z `layoutEffect: false` ta wersja biblioteki jeszcze nie zna.
  const { scrollY } = useScroll();

  // Własny pomiar, ale wykonywany raz przy montażu i przy zmianie okna,
  // a nie przy każdym przewinięciu — to była właściwa wada poprzedniej wersji.
  const [droga, setDroga] = useState({ start: 0, dlugosc: 1 });

  useEffect(() => {
    if (bezRuchu) return;
    const node = blok.current;
    if (!node) return;

    const zmierz = () => {
      const p = node.getBoundingClientRect();
      setDroga({
        start: p.top + window.scrollY,
        dlugosc: Math.max(1, p.height - window.innerHeight),
      });
    };

    zmierz();
    const obserwator = new ResizeObserver(zmierz);
    obserwator.observe(node);
    window.addEventListener('resize', zmierz);

    return () => {
      obserwator.disconnect();
      window.removeEventListener('resize', zmierz);
    };
  }, [bezRuchu]);

  const ustaw = useCallback(
    (y: number) => {
      const postep = Math.min(1, Math.max(0, (y - droga.start) / droga.dlugosc));
      // `min` z ostatnim indeksem, bo przy postępie równym 1 mnożenie daje
      // indeks poza tablicą.
      setAktywny(Math.min(kroki.length - 1, Math.floor(postep * kroki.length)));
    },
    [droga, kroki.length]
  );

  useMotionValueEvent(scrollY, 'change', (y) => {
    if (!bezRuchu) ustaw(y);
  });

  // Wejście na stronę w środku sekcji (kotwica, powrót z karty produktu)
  // nie wywoła zmiany wartości, więc pierwszy krok liczymy sami.
  useEffect(() => {
    if (!bezRuchu) ustaw(window.scrollY);
  }, [bezRuchu, ustaw]);

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
