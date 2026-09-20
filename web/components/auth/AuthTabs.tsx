'use client';

import Link from 'next/link';
import { PrzyciskWysylki } from './PrzyciskWysylki';
import { useActionState, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { signInAction, signUpAction, type AuthState } from '@/app/actions/auth';
import { useRuchWylaczony } from '@/lib/ruch';
import { PlamaWyboru } from '@/components/ruch/PlamaWyboru';
import { PoleWarunkowe } from '@/components/ruch/PoleWarunkowe';

/**
 * Warianty panelu logowania i rejestracji.
 *
 * Kierunek wjazdu zależy od tego, w którą stronę idzie użytkownik: z logowania
 * do rejestracji panel wchodzi z prawej, z powrotem — z lewej. Bez tego oba
 * przejścia wyglądają tak samo i zakładki przestają nieść informację, gdzie
 * się jest. To ten sam pomysł, co w przykładzie „Clerk: Sign-in-or-up"
 * z katalogu Motion; tam też o kierunku decyduje `custom`.
 *
 * Wysokość zmienia się razem z treścią — rejestracja ma o jedno pole więcej
 * i bez animowania wysokości przycisk pod spodem przeskakiwałby.
 */
const PANEL = {
  wejscie: (kierunek: number) => ({ opacity: 0, x: kierunek * 24 }),
  na_miejscu: { opacity: 1, x: 0 },
  wyjscie: (kierunek: number) => ({ opacity: 0, x: kierunek * -24 }),
};

/**
 * Logowanie i rejestracja na Server Actions: hasło nie przechodzi przez
 * żaden stan Reacta, a odpowiedź serwera ustawia ciasteczko sesji.
 */
export function AuthTabs({ defaultTab, back }: { defaultTab: 'login' | 'register'; back: string }) {
  const [tab, setTab] = useState(defaultTab);
  const [signInState, signIn] = useActionState<AuthState, FormData>(signInAction, {});
  const [signUpState, signUp] = useActionState<AuthState, FormData>(signUpAction, {});
  const bezRuchu = useRuchWylaczony();

  const state = tab === 'login' ? signInState : signUpState;
  // Logowanie leży po lewej, rejestracja po prawej — kierunek wjazdu bierze się
  // wprost z tego, która zakładka jest aktywna.
  const kierunek = tab === 'register' ? 1 : -1;

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
          {tab === 'login' && <PlamaWyboru layoutId="tab-wskaznik" className="tab-wskaznik" />}
          <span className="tab-tekst">Logowanie</span>
        </button>
        <button
          className="tab"
          role="tab"
          type="button"
          aria-selected={tab === 'register'}
          onClick={() => setTab('register')}
        >
          {tab === 'register' && <PlamaWyboru layoutId="tab-wskaznik" className="tab-wskaznik" />}
          <span className="tab-tekst">Rejestracja</span>
        </button>
      </div>

      <PoleWarunkowe>
        {state.error && (
          <p className="notice notice-error" role="alert">
            {state.error}
          </p>
        )}
      </PoleWarunkowe>
      <PoleWarunkowe>
        {state.notice && (
          <p className="notice notice-ok" role="status">
            {state.notice}
          </p>
        )}
      </PoleWarunkowe>

      <PanelPrzejscia klucz={tab} kierunek={kierunek} bezRuchu={bezRuchu}>
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
          <p className="auth-pod-polem">
            <Link href="/haslo/reset">Nie pamiętasz hasła?</Link>
            {' · '}
            <Link href={`/logowanie/link?powrot=${encodeURIComponent(back)}`}>
              Zaloguj się linkiem
            </Link>
          </p>
          <PrzyciskWysylki etykieta="Zaloguj się" wTrakcie="Chwileczkę…" />
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
              minLength={8}
              required
            />
            <p className="field-hint">Co najmniej osiem znaków, w tym mała litera, wielka i cyfra.</p>
          </div>
          <PrzyciskWysylki etykieta="Załóż konto" wTrakcie="Chwileczkę…" />
        </form>
      )}
      </PanelPrzejscia>
    </div>
  );
}

/**
 * Opakowanie panelu formularza.
 *
 * `mode="wait"` — panel wychodzący musi zniknąć, zanim wejdzie następny.
 * Bez tego dwa formularze na moment leżą na sobie i przeglądarka potrafi
 * przenieść fokus do pola, które właśnie jest odmontowywane.
 *
 * `initial={false}` — pierwsze wejście nie jest animowane. Formularz logowania
 * to często pierwsza rzecz, którą ktoś widzi po kliknięciu „Konto"; wjeżdżanie
 * z boku na starcie wygląda jak opóźnienie, nie jak efekt.
 *
 * Przy wyłączonym ruchu schodzi czas, nie drzewo. Gałąź zwracająca goły
 * fragment odmontowywałaby formularz tuż po hydratacji — `useRuchWylaczony`
 * startuje od `true`, więc React zobaczyłby wtedy inny typ elementu w tym
 * samym miejscu i skasował wpisane już pola.
 */
function PanelPrzejscia({
  klucz,
  kierunek,
  bezRuchu,
  children,
}: {
  klucz: string;
  kierunek: number;
  bezRuchu: boolean;
  children: React.ReactNode;
}) {
  return (
    <MotionConfig
      transition={bezRuchu ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence mode="wait" initial={false} custom={kierunek}>
        <motion.div
          key={klucz}
          custom={kierunek}
          variants={PANEL}
          initial="wejscie"
          animate="na_miejscu"
          exit="wyjscie"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
