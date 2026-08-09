'use client';

import { useRuchWylaczony } from '@/lib/ruch';

/**
 * Przewijający się poziomo pasek pod nagłówkiem.
 *
 * Skill zakazuje karuzeli z autoprzewijaniem i to zostaje w mocy — ale dotyczy
 * karuzeli **produktów**, w której pozycja sama ucieka z pola widzenia, zanim
 * ktoś zdąży ją kliknąć. Tutaj przewija się tekst: nic nie znika bezpowrotnie,
 * bo pętla wraca, nic nie trzeba złapać w locie, a pod kursorem pasek staje.
 *
 * Szew: treść stoi w dokumencie kilka razy, a animacja przesuwa tor dokładnie
 * o jedną kopię. Po tym przesunięciu następny komplet jest tam, gdzie zaczynał
 * poprzedni — powrót do zera jest niewidoczny, bo obraz jest ten sam.
 * Duplikaty dostają `aria-hidden`, żeby czytnik ekranu nie przeczytał
 * wszystkiego kilka razy.
 *
 * Kopii jest cztery, nie dwie. Przy dwóch szew był niewidoczny tylko wtedy,
 * gdy pojedynczy komplet był szerszy od ekranu — przy trzech krótkich hasłach
 * na szerokim monitorze tor kończył się w połowie widoku i pasek jechał
 * z pustym pasem, czekając na powrót pętli. Cztery kopie pokrywają ekran także
 * przy krótkiej treści, a że przesunięcie dalej wynosi jedną kopię, prędkość
 * zostaje ta sama.
 */
const KOPIE = 4;

export function Marquee({ hasla }: { hasla: string[] }) {
  const bezRuchu = useRuchWylaczony();

  if (hasla.length === 0) return null;

  const komplet = (ukryty: boolean) => (
    <ul className="marquee-lista" aria-hidden={ukryty || undefined}>
      {hasla.map((h, i) => (
        <li key={`${h}-${i}`}>
          {h}
          <span className="marquee-kropka" aria-hidden="true">
            ·
          </span>
        </li>
      ))}
    </ul>
  );

  // Bez ruchu pasek zostaje statyczną listą: jeden komplet, bez duplikatu
  // i bez przewijania. Treść jest ta sama, tylko cała naraz.
  if (bezRuchu) {
    return (
      <div className="marquee marquee-stoi">
        <div className="marquee-tor">{komplet(false)}</div>
      </div>
    );
  }

  return (
    <div className="marquee">
      {/* Liczba kopii jedzie do CSS-u zmienną, żeby przesunięcie w klatkach
          kluczowych nie rozjechało się z tym, ile kompletów faktycznie stoi
          w torze — rozjazd tych dwóch liczb to dokładnie ten przeskok, który
          tu naprawiamy. */}
      <div className="marquee-tor" style={{ ['--kopie' as string]: KOPIE }}>
        {Array.from({ length: KOPIE }, (_, i) => (
          <div className="marquee-komplet" key={i}>
            {komplet(i > 0)}
          </div>
        ))}
      </div>
    </div>
  );
}
