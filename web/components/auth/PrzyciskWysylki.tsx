'use client';

import { useFormStatus } from 'react-dom';

/**
 * Przycisk wysyłki formularza auth.
 *
 * `useFormStatus` czyta stan najbliższego `<form>` w górę drzewa, więc musi
 * siedzieć w osobnym komponencie — w tym samym, który renderuje formularz,
 * hak zwraca `pending: false` i przycisk nigdy się nie blokuje. Stąd cztery
 * bliźniacze definicje `Submit()` w `components/auth/`, różniące się samą
 * etykietą; ta jedna je zastępuje.
 */
export function PrzyciskWysylki({
  etykieta,
  wTrakcie,
}: {
  etykieta: string;
  /** Napis na czas czekania — „Wysyłam…", „Zapisuję…". */
  wTrakcie: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-block" type="submit" disabled={pending} style={{ marginTop: 20 }}>
      {pending ? wTrakcie : etykieta}
    </button>
  );
}
