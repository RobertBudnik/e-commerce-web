'use client';

/**
 * Stepper ilości: minus, pole, plus.
 *
 * Stał w czterech miejscach wklejony znak w znak — karta produktu, podgląd
 * z listy, koszyk i szuflada. Cztery kopie znaczą cztery miejsca, w których
 * trzeba poprawić etykietę dla czytnika ekranu albo sufit stanu, i przy
 * pierwszej poprawce dwie z nich zostają ze starą wersją.
 *
 * **Krok i wpis to dwa osobne wywołania i to jest tu najważniejsze.**
 * Komponent nie liczy `wartosc + 1` sam z siebie, bo `wartosc` pochodzi
 * z renderu: koszyk ma na to `bump()`, który czyta stan bieżący, właśnie
 * dlatego, że trzy szybkie kliknięcia w „+" ustawiały ilość na 2 zamiast
 * na 4. Gdyby stepper liczył krok u siebie, wróciłby ten sam błąd.
 *
 * Minus to U+2212, nie dywiz. W kroju maszynowym dywiz jest krótszy i wyżej
 * niż plus, więc para przycisków traciła pion — ta sama decyzja, co przy
 * `zeZnakiem` w `lib/format.ts`.
 */
export function Ilosc({
  wartosc,
  stan,
  onKrok,
  onWpis,
}: {
  wartosc: number;
  /** Górny sufit — stan magazynowy. Zero znaczy „brak", więc pole stoi na 1. */
  stan: number;
  /** Kliknięcie w „−" albo „+": −1 albo +1. Wywołujący liczy od stanu bieżącego. */
  onKrok: (delta: number) => void;
  /** Wpisana liczba. Puste pole daje 0 — wywołujący decyduje, co to znaczy. */
  onWpis: (ilosc: number) => void;
}) {
  return (
    <div className="qty">
      <button type="button" aria-label="Zmniejsz ilość" onClick={() => onKrok(-1)}>
        −
      </button>
      <input
        type="number"
        value={wartosc}
        min={1}
        max={stan || 1}
        aria-label="Ilość"
        onChange={(e) => onWpis(Number(e.target.value) || 0)}
      />
      <button type="button" aria-label="Zwiększ ilość" onClick={() => onKrok(1)}>
        +
      </button>
    </div>
  );
}
