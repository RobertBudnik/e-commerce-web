'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { sciezkaPowrotu } from '@/lib/sciezka-powrotu';
import { wolnoWyslac } from '@/lib/limity';
import { siteUrl } from '@/lib/site';

/**
 * Logowanie, rejestracja, reset hasła i logowanie linkiem — po stronie serwera.
 *
 * Hasło leci z formularza prosto do Supabase Auth i nigdzie nie jest
 * zapisywane. Sesję ustawia serwer w ciasteczkach `HttpOnly` — przeglądarka
 * nie ma do nich dostępu, więc XSS nie wyniesie tokenu.
 *
 * Zasada przewijająca się przez cały plik: **żaden komunikat nie zdradza, czy
 * konto istnieje**. Formularz, który na jeden adres odpowiada „konto już
 * istnieje", a na drugi „wysłaliśmy wiadomość", jest wyszukiwarką kont —
 * wystarczy lista adresów i pętla, żeby wyciągnąć z niego, kto jest klientem
 * tego sklepu. Dlatego rejestracja, reset i logowanie linkiem kończą się
 * zawsze tym samym zdaniem, niezależnie od tego, co naprawdę zaszło.
 */

export type AuthState = { error?: string; notice?: string };

/** Jedna odpowiedź na wszystkie drogi wysyłki. Patrz komentarz wyżej. */
const ZAWSZE_TO_SAMO =
  'Jeśli ten adres jest u nas zarejestrowany, wysłaliśmy na niego wiadomość. Sprawdź skrzynkę, także folder ze spamem.';

/**
 * Walidacja adresu po stronie serwera.
 *
 * `type="email"` w formularzu jest podpowiedzią dla przeglądarki, nie
 * zaporą — żądanie da się wysłać z konsoli albo curlem. Wzorzec celowo
 * zgrubny: pełna zgodność z RFC 5322 przepuszcza rzeczy, których i tak nie
 * obsłuży żaden dostawca poczty, a odrzuca adresy, które działają.
 */
const ADRES = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function adresPoprawny(email: string): boolean {
  return email.length <= 254 && ADRES.test(email);
}

/** Dokąd Supabase ma odesłać po kliknięciu linku z wiadomości. */
function powrotZPoczty(next: string): string {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  // Adres powrotu przychodzi z ukrytego pola formularza, więc jest spod
  // kontroli tego, kto podsunął link. Bez sprawdzenia `redirect()` odsyłał
  // zalogowanego już gościa na obcą domenę.
  const back = sciezkaPowrotu(formData.get('powrot'));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: bladLogowania(error.message) };

  revalidatePath('/', 'layout');
  redirect(back);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!adresPoprawny(email)) return { error: 'To nie wygląda na adres e-mail.' };

  if (!(await wolnoWyslac(email, 'rejestracja'))) {
    return { error: 'Za dużo prób z tego miejsca. Spróbuj za godzinę.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: powrotZPoczty('/konto'),
    },
  });

  // Błąd hasła musi dojść do człowieka — inaczej formularz milczy, a konto
  // nie powstaje. Reszta błędów idzie w jedno zdanie, żeby nie zdradzić,
  // czy adres jest zajęty.
  if (error) {
    if (/password/i.test(error.message)) return { error: wymogiHasla() };
    if (/rate limit|too many/i.test(error.message)) {
      return { error: 'Za dużo prób. Spróbuj za chwilę.' };
    }
    return { notice: ZAWSZE_TO_SAMO };
  }

  // Przy włączonym potwierdzeniu Supabase nie zwraca sesji — konto czeka na
  // kliknięcie linku i nie wolno udawać zalogowania.
  if (!data.session) {
    redirect(`/rejestracja/sprawdz-skrzynke?adres=${encodeURIComponent(email)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/konto');
}

/**
 * Ponowna wysyłka linku potwierdzającego.
 *
 * Interfejs ma własną blokadę 60 s — to uprzejmość wobec człowieka, nie
 * zabezpieczenie. Zabezpieczeniem jest licznik w bazie, bo przycisk da się
 * ominąć, a wywołanie akcji nie.
 */
export async function resendAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!adresPoprawny(email)) return { error: 'To nie wygląda na adres e-mail.' };

  if (!(await wolnoWyslac(email, 'ponowna'))) {
    return { error: 'Wysłaliśmy już kilka wiadomości na ten adres. Spróbuj za godzinę.' };
  }

  const supabase = await createClient();
  await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: powrotZPoczty('/konto') },
  });

  // Wyniku nie sprawdzamy celowo: „nie ma takiego konta" i „wysłano" muszą
  // wyglądać tak samo.
  return { notice: ZAWSZE_TO_SAMO };
}

/** Wysyłka linku do ustawienia nowego hasła. */
export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!adresPoprawny(email)) return { error: 'To nie wygląda na adres e-mail.' };

  if (!(await wolnoWyslac(email, 'reset'))) {
    return { error: 'Wysłaliśmy już kilka wiadomości na ten adres. Spróbuj za godzinę.' };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: powrotZPoczty('/haslo/nowe'),
  });

  return { notice: ZAWSZE_TO_SAMO };
}

/** Logowanie linkiem, bez hasła. */
export async function magicLinkAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const back = sciezkaPowrotu(formData.get('powrot'));

  if (!adresPoprawny(email)) return { error: 'To nie wygląda na adres e-mail.' };

  if (!(await wolnoWyslac(email, 'magic'))) {
    return { error: 'Wysłaliśmy już kilka wiadomości na ten adres. Spróbuj za godzinę.' };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: powrotZPoczty(back),
      // Logowanie linkiem nie jest furtką do zakładania kont bez hasła —
      // rejestracja ma własną drogę, z imieniem i zgodą.
      shouldCreateUser: false,
    },
  });

  return { notice: ZAWSZE_TO_SAMO };
}

/** Ustawienie nowego hasła na sesji odzyskiwania. */
export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const haslo = String(formData.get('password') ?? '');
  const powtorka = String(formData.get('password2') ?? '');

  if (haslo !== powtorka) return { error: 'Hasła nie są takie same.' };
  if (!hasloMocne(haslo)) return { error: wymogiHasla() };

  const supabase = await createClient();

  // Bez sesji nie ma czego zmieniać. Tak wygląda wejście na ten adres
  // z palca albo po wygaśnięciu linku.
  const { data: kto } = await supabase.auth.getUser();
  if (!kto.user) {
    return { error: 'Link wygasł albo został już użyty. Poproś o nowy.' };
  }

  const { error } = await supabase.auth.updateUser({ password: haslo });
  if (error) return { error: /password/i.test(error.message) ? wymogiHasla() : error.message };

  revalidatePath('/', 'layout');
  redirect('/konto');
}

export async function signOutAction() {
  const supabase = await createClient();
  // `global` unieważnia wszystkie sesje tego konta, nie tylko tę przeglądarkę.
  // Kto się wylogowuje na cudzym komputerze, chce właśnie tego.
  await supabase.auth.signOut({ scope: 'global' });

  revalidatePath('/', 'layout');
  // Po wylogowaniu strona główna, nie formularz logowania: klient kończy
  // zakupy, a nie zaczyna kolejne logowanie.
  redirect('/');
}

/** Ta sama reguła co w `supabase/config.toml` — osiem znaków, trzy klasy. */
function hasloMocne(haslo: string): boolean {
  return (
    haslo.length >= 8 && /[a-z]/.test(haslo) && /[A-Z]/.test(haslo) && /[0-9]/.test(haslo)
  );
}

function wymogiHasla() {
  return 'Hasło potrzebuje co najmniej ośmiu znaków, w tym małej litery, wielkiej i cyfry.';
}

/**
 * Komunikat logowania celowo zbija trzy sytuacje w jedną.
 *
 * „Nieprawidłowe hasło" i „potwierdź adres" to dwa różne zdania, a różnica
 * między nimi mówi pytającemu, że konto istnieje. Zdanie niżej jest prawdziwe
 * w każdym z tych przypadków i w żadnym nie potwierdza istnienia konta.
 */
function bladLogowania(message: string) {
  if (/rate limit|too many/i.test(message)) return 'Za dużo prób. Spróbuj za chwilę.';
  return 'Nie udało się zalogować. Sprawdź adres i hasło — a jeśli konto jest nowe, potwierdź je linkiem z wiadomości.';
}
