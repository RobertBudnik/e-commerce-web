'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signInAction, signUpAction, type AuthState } from '@/app/actions/auth';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-block" type="submit" disabled={pending} style={{ marginTop: 20 }}>
      {pending ? 'Chwileczkę…' : label}
    </button>
  );
}

/**
 * Logowanie i rejestracja na Server Actions: hasło nie przechodzi przez
 * żaden stan Reacta, a odpowiedź serwera ustawia ciasteczko sesji.
 */
export function AuthTabs({ defaultTab, back }: { defaultTab: 'login' | 'register'; back: string }) {
  const [tab, setTab] = useState(defaultTab);
  const [signInState, signIn] = useActionState<AuthState, FormData>(signInAction, {});
  const [signUpState, signUp] = useActionState<AuthState, FormData>(signUpAction, {});

  const state = tab === 'login' ? signInState : signUpState;

  return (
    <div>
      <div className="tabs" role="tablist">
        <button
          className="tab"
          role="tab"
          type="button"
          aria-selected={tab === 'login'}
          onClick={() => setTab('login')}
        >
          Logowanie
        </button>
        <button
          className="tab"
          role="tab"
          type="button"
          aria-selected={tab === 'register'}
          onClick={() => setTab('register')}
        >
          Rejestracja
        </button>
      </div>

      {state.error && (
        <p className="notice notice-error" role="alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="notice notice-ok" role="status">
          {state.notice}
        </p>
      )}

      {tab === 'login' ? (
        <form action={signIn}>
          <input type="hidden" name="powrot" value={back} />
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="login-password">Hasło</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Submit label="Zaloguj się" />
        </form>
      ) : (
        <form action={signUp}>
          <div className="field">
            <label htmlFor="reg-name">Imię i nazwisko</label>
            <input id="reg-name" name="name" type="text" autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="reg-email">E-mail</label>
            <input id="reg-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="reg-password">Hasło</label>
            <input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
            <p className="field-hint">Minimum 6 znaków.</p>
          </div>
          <Submit label="Załóż konto" />
        </form>
      )}
    </div>
  );
}
