'use client';

import { useEffect, useState } from 'react';

/**
 * Toast bez biblioteki: zdarzenie na `window`, jeden element w DOM.
 * `role="status"` czyta czytnik ekranu, animację robi klasa `.show`.
 */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent('nordo:toast', { detail: message }));
}

export function ToastHost() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 2400);
    };

    window.addEventListener('nordo:toast', onToast);
    return () => {
      window.removeEventListener('nordo:toast', onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div className={`toast${visible ? ' show' : ''}`} role="status">
      {message}
    </div>
  );
}
