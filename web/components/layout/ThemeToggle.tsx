'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

const KLUCZ = 'nordo-theme';

/**
 * Przełącznik motywu. Klasę na <html> ustawia już skrypt blokujący z layoutu —
 * ten komponent tylko ją odwraca i zapisuje wybór.
 *
 * Stan startowy czytamy z DOM, a nie z localStorage: skrypt w <head> zdążył
 * uwzględnić też ustawienie systemowe, więc klasa jest źródłem prawdy.
 */
export function ThemeToggle() {
  const [ciemny, setCiemny] = useState(false);
  const [gotowy, setGotowy] = useState(false);

  useEffect(() => {
    setCiemny(document.documentElement.classList.contains('dark'));
    setGotowy(true);

    // Skrypt z layoutu przełącza klasę, gdy system zmieni ustawienie i nie ma
    // zapisanego wyboru. Bez tego samego nasłuchu tutaj ikona zostawałaby
    // z poprzedniego motywu — księżyc na ciemnym tle.
    const pytanie = matchMedia('(prefers-color-scheme: dark)');
    const zmiana = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(KLUCZ)) return;
      setCiemny(e.matches);
    };
    pytanie.addEventListener('change', zmiana);
    return () => pytanie.removeEventListener('change', zmiana);
  }, []);

  // Dopóki nie wiemy, który motyw jest aktywny, ikona byłaby zgadywana —
  // a mrugnięcie słońcem w ciemności wygląda jak usterka.
  function przelacz() {
    const nowy = !ciemny;
    document.documentElement.classList.toggle('dark', nowy);
    try {
      localStorage.setItem(KLUCZ, nowy ? 'dark' : 'light');
    } catch {
      /* tryb prywatny bez zapisu — motyw zadziała do końca sesji */
    }
    setCiemny(nowy);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={przelacz}
      aria-label="Przełącz motyw"
      aria-pressed={gotowy ? ciemny : undefined}
      title={ciemny ? 'Motyw jasny' : 'Motyw ciemny'}
    >
      <Icon name={gotowy && ciemny ? 'sun' : 'moon'} />
    </button>
  );
}
