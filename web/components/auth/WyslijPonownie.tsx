'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { resendAction, type AuthState } from '@/app/actions/auth';

const BLOKADA_S = 60;

function Przycisk({ zostalo }: { zostalo: number }) {
  const { pending } = useFormStatus();
  const zablokowany = pending || zostalo > 0;

  return (
    <button className="btn btn-ghost" type="submit" disabled={zablokowany}>
      {pending ? 'Wysyłam…' : zostalo > 0 ? `Wyślij ponownie za ${zostalo} s` : 'Wyślij ponownie'}
    </button>
  );
}

/**
 * Ponowna wysyłka linku potwierdzającego.
 *
 * Blokada 60 s jest **uprzejmością wobec człowieka**, nie zabezpieczeniem:
 * mówi wprost, ile czekać, zamiast pozwolić klikać w kółko i zbierać błędy.
 * Prawdziwy limit siedzi w bazie (`limity_poczty`) i liczy się po adresie IP
 * oraz po skrzynce — ten przycisk da się ominąć konsolą, tamtego nie.
 *
 * Odliczanie startuje po odpowiedzi serwera, nie po kliknięciu. Inaczej
 * odrzucone żądanie też blokowałoby przycisk na minutę.
 */
export function WyslijPonownie({ adres }: { adres: string }) {
  const [stan, wyslij] = useActionState<AuthState, FormData>(resendAction, {});
  const [zostalo, setZostalo] = useState(0);

  useEffect(() => {
    if (!stan.notice) return;
    setZostalo(BLOKADA_S);
  }, [stan]);

  useEffect(() => {
    if (zostalo <= 0) return;
    const licznik = setTimeout(() => setZostalo((s) => s - 1), 1000);
    return () => clearTimeout(licznik);
  }, [zostalo]);

  return (
    <form action={wyslij} className="auth-ponownie">
      <input type="hidden" name="email" value={adres} />
      <Przycisk zostalo={zostalo} />

      {/* `role="status"` zamiast zwykłego akapitu: czytnik ekranu ma
          powiedzieć, że wiadomość poszła, bez przenoszenia fokusu. */}
      {stan.notice && (
        <p className="auth-komunikat" role="status">
          {stan.notice}
        </p>
      )}
      {stan.error && (
        <p className="auth-blad" role="status">
          {stan.error}
        </p>
      )}
    </form>
  );
}
