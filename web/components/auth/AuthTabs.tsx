'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { signInAction, signUpAction, type AuthState } from '@/app/actions/auth';
import { useRuchWylaczony } from '@/lib/ruch';

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
 * Treść, która dochodzi i znika w miejscu, nie spychając reszty skokiem.
 *
 * Wzorzec „Clerk: Conditional Field" z katalogu Motion: animowana jest
 * wysokość razem z przejrzystością, więc formularz pod spodem zjeżdża
 * płynnie zamiast przeskakiwać o wysokość komunikatu.
 *
 * `height: 'auto'` w Motion mierzy element i animuje do zmierzonej wartości,
 * więc działa też wtedy, gdy komunikat złamie się na dwa wiersze.
 * `overflow: hidden` jest konieczny — bez niego treść wystaje poza kurczące
 * się pudełko przez cały czas trwania animacji.
 */
function PoleWarunkowe({
  bezRuchu,
  children,
}: {
  bezRuchu: boolean;
  children: React.ReactNode;
}) {
  if (bezRuchu) return <>{children}</>;

  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Podkreślenie aktywnej zakładki — ten sam `layoutId`, co przy filtrach. */
function WskaznikZakladki({ bezRuchu }: { bezRuchu: boolean }) {
  if (bezRuchu) return <span className="tab-wskaznik" aria-hidden="true" />;

  return (
    <motion.span
      className="tab-wskaznik"
      aria-hidden="true"
      layoutId="tab-wskaznik"
      transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
    />
  );
}

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
          {tab === 'login' && <WskaznikZakladki bezRuchu={bezRuchu} />}
          <span className="tab-tekst">Logowanie</span>
        </button>
        <button
          className="tab"
          role="tab"
          type="button"
          aria-selected={tab === 'register'}
          onClick={() => setTab('register')}
        >
          {tab === 'register' && <WskaznikZakladki bezRuchu={bezRuchu} />}
          <span className="tab-tekst">Rejestracja</span>
        </button>
      </div>

      <PoleWarunkowe bezRuchu={bezRuchu}>
        {state.error && (
          <p className="notice notice-error" role="alert">
            {state.error}
          </p>
        )}
      </PoleWarunkowe>
      <PoleWarunkowe bezRuchu={bezRuchu}>
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
  if (bezRuchu) return <>{children}</>;

  return (
    <MotionConfig transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
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
