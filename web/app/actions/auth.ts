'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

/**
 * Logowanie, rejestracja i wylogowanie po stronie serwera.
 *
 * Hasło leci z formularza prosto do Supabase Auth i nigdzie nie jest
 * zapisywane. Sesję ustawia serwer w ciasteczkach `HttpOnly` — przeglądarka
 * nie ma do nich dostępu, więc XSS nie wyniesie tokenu.
 */

export type AuthState = { error?: string; notice?: string };

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const back = String(formData.get('powrot') ?? '/konto');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: authMessage(error.message) };

  revalidatePath('/', 'layout');
  redirect(back);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) return { error: authMessage(error.message) };

  // Przy `enable_confirmations = true` Supabase nie zwraca sesji — konto
  // czeka na kliknięcie linku z maila i nie wolno udawać zalogowania.
  if (!data.session) {
    return { notice: 'Konto założone. Kliknij link z wiadomości e-mail, żeby je potwierdzić.' };
  }

  revalidatePath('/', 'layout');
  redirect('/konto');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  // Po wylogowaniu strona główna, nie formularz logowania: klient kończy
  // zakupy, a nie zaczyna kolejne logowanie.
  redirect('/');
}

/** Komunikaty Supabase są po angielsku — tłumaczymy te, które widuje klient. */
function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Nieprawidłowy e-mail albo hasło.';
  if (/email not confirmed/i.test(message)) return 'Potwierdź adres e-mail linkiem z wiadomości.';
  if (/user already registered/i.test(message)) return 'Konto z tym adresem już istnieje.';
  if (/password should be at least/i.test(message)) return 'Hasło musi mieć co najmniej 6 znaków.';
  if (/rate limit|too many/i.test(message)) return 'Za dużo prób. Spróbuj za chwilę.';
  return message;
}
