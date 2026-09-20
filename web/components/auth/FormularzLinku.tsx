'use client';

import { useActionState } from 'react';
import { magicLinkAction, type AuthState } from '@/app/actions/auth';
import { PrzyciskWysylki } from './PrzyciskWysylki';

/**
 * Logowanie bez hasła.
 *
 * Po wysyłce formularz ustępuje komunikatowi — zostawiony zapraszałby do
 * klikania w kółko, a każde kliknięcie to kolejna wiadomość w skrzynce.
 */
export function FormularzLinku({ powrot }: { powrot: string }) {
  const [stan, wyslij] = useActionState<AuthState, FormData>(magicLinkAction, {});

  if (stan.notice) {
    return (
      <p className="auth-komunikat" role="status">
        {stan.notice}
      </p>
    );
  }

  return (
    <form action={wyslij}>
      <input type="hidden" name="powrot" value={powrot} />

      <label className="field">
        <span className="label">E-mail</span>
        <input id="link-email" name="email" type="email" autoComplete="email" required />
      </label>

      {stan.error && (
        <p className="auth-blad" role="status">
          {stan.error}
        </p>
      )}

      <PrzyciskWysylki etykieta="Wyślij link do logowania" wTrakcie="Wysyłam…" />
    </form>
  );
}
