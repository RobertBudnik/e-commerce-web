'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { initials } from '@/lib/format';
import { signOutAction } from '@/app/actions/auth';
import type { SessionUser } from '@/lib/types';

export function AccountMenu({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  if (!user) {
    return (
      <div className="account-menu" ref={box}>
        <button
          className="icon-btn"
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((v) => !v)}
        >
          {/* Podpis w tej samej klasie co przy zalogowanym koncie — wąski
              nagłówek chowa go i zostawia samą ikonę, inaczej „Konto"
              wypychało koszyk poza krawędź ekranu. */}
          <Icon name="user" /> <span className="account-name">Konto</span>
        </button>
        <div className="menu" data-open={String(open)}>
          <Link href="/logowanie">
            <Icon name="logout" /> Zaloguj się
          </Link>
          <Link href="/logowanie?tryb=rejestracja">
            <Icon name="user" /> Załóż konto
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="account-menu" ref={box}>
      <button
        className="account-btn"
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar">{initials(user.name, user.email)}</span>
        <span className="account-name">{user.name}</span>
      </button>
      <div className="menu" data-open={String(open)}>
        <Link href="/konto">
          <Icon name="user" /> Moje konto
        </Link>
        <Link href="/konto#wishlist">
          <Icon name="heart" /> Lista życzeń
        </Link>
        {user.role === 'admin' && (
          <>
            {/* Magazyn wyżej niż katalog: pakowanie to codzienność,
                edycja produktów zdarza się raz na jakiś czas. */}
            <Link href="/magazyn">
              <Icon name="box" /> Magazyn
            </Link>
            <Link href="/panel">
              <Icon name="grid" /> Panel firmy
            </Link>
          </>
        )}
        <div className="menu-sep" />
        {/* Wylogowanie idzie Server Action: ciasteczko sesji kasuje serwer,
            przeglądarka nie ma do niego dostępu. */}
        <form action={signOutAction}>
          <button type="submit">
            <Icon name="logout" /> Wyloguj
          </button>
        </form>
      </div>
    </div>
  );
}
