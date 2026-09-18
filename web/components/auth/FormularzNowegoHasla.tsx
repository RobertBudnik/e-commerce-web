'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updatePasswordAction, type AuthState } from '@/app/actions/auth';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-block" type="submit" disabled={pending} style={{ marginTop: 20 }}>
      {pending ? 'Zapisuję…' : 'Ustaw nowe hasło'}
    </button>
  );
}

/**
 * Ustawienie nowego hasła na sesji odzyskiwania.
 *
 * Wymogi hasła stoją nad polem, nie pod nim i nie w komunikacie błędu.
 * Reguła przeczytana przed wpisaniem oszczędza jedno odrzucone podejście;
 * ta sama reguła pokazana po odrzuceniu jest już tylko wyrzutem.
 */
export function FormularzNowegoHasla() {
  const [stan, zapisz] = useActionState<AuthState, FormData>(updatePasswordAction, {});

  return (
    <form action={zapisz}>
      <p className="auth-wymogi" id="wymogi-hasla">
        Co najmniej osiem znaków, w tym mała litera, wielka i cyfra.
      </p>

      <label className="field">
        <span className="label">Nowe hasło</span>
        <input
          id="nowe-haslo"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="wymogi-hasla"
          minLength={8}
          required
        />
      </label>

      <label className="field">
        <span className="label">Powtórz hasło</span>
        <input
          id="nowe-haslo-2"
          name="password2"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
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
