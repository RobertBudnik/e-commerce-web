'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { resetPasswordAction, type AuthState } from '@/app/actions/auth';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-block" type="submit" disabled={pending} style={{ marginTop: 20 }}>
      {pending ? 'Wysyłam…' : 'Wyślij link'}
    </button>
  );
}

/**
 * Prośba o link do nowego hasła.
 *
 * Po udanej wysyłce formularz **znika**, a zostaje sam komunikat. To nie
 * kosmetyka: zostawiony formularz zaprasza do klikania w kółko, a każde
 * kliknięcie to kolejna wiadomość w cudzej skrzynce.
 */
export function FormularzResetu() {
  const [stan, wyslij] = useActionState<AuthState, FormData>(resetPasswordAction, {});

  if (stan.notice) {
    return (
      <p className="auth-komunikat" role="status">
        {stan.notice}
      </p>
    );
  }

  return (
    <form action={wyslij}>
      <label className="field">
        <span className="label">E-mail</span>
        <input id="reset-email" name="email" type="email" autoComplete="email" required />
      </label>

      {stan.error && (
        <p className="auth-blad" role="status">
          {stan.error}
        </p>
      )}

      <Submit />
    </form>
  );
}
