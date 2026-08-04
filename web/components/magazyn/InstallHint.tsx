'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

const KLUCZ = 'nordo-install-hint';

type Stan = 'ukryj' | 'safari' | 'chrome-ios';

/**
 * Podpowiedź instalacji. Na iOS nie ma zdarzenia `beforeinstallprompt`, więc
 * przeglądarka nie zaproponuje niczego sama — instrukcję trzeba napisać.
 *
 * Osobny przypadek to Chrome na iPhonie: wygląda jak Chrome, ale pod spodem
 * jest Safari bez opcji „Dodaj do ekranu początkowego". Bez tego rozróżnienia
 * jeden z was instaluje aplikację w minutę, a drugi szuka przycisku,
 * którego nie ma.
 */
export function InstallHint() {
  const [stan, setStan] = useState<Stan>('ukryj');

  useEffect(() => {
    try {
      if (localStorage.getItem(KLUCZ) === 'ok') return;
    } catch {
      /* brak dostępu do zapisu — podpowiedź pokaże się ponownie */
    }

    // Uruchomione z ekranu początkowego? Wtedy nie ma czego instalować.
    const zainstalowane =
      (navigator as { standalone?: boolean }).standalone === true ||
      matchMedia('(display-mode: standalone)').matches;
    if (zainstalowane) return;

    const ua = navigator.userAgent;
    if (!/iPhone|iPad|iPod/.test(ua)) return;

    setStan(/CriOS|FxiOS|EdgiOS/.test(ua) ? 'chrome-ios' : 'safari');
  }, []);

  if (stan === 'ukryj') return null;

  function schowaj() {
    try {
      localStorage.setItem(KLUCZ, 'ok');
    } catch {
      /* bez zapisu podpowiedź wróci przy następnym wejściu */
    }
    setStan('ukryj');
  }

  return (
    <aside className="install-hint">
      <div className="install-hint-text">
        <p className="label">Na ekran początkowy</p>
        {stan === 'safari' ? (
          <p>
            Naciśnij <strong>Udostępnij</strong> na dolnym pasku, przewiń w dół i wybierz{' '}
            <strong>Dodaj do ekranu początkowego</strong>. Magazyn otworzy się wtedy na pełnym
            ekranie, bez paska adresu.
          </p>
        ) : (
          <p>
            Otwórz ten adres w <strong>Safari</strong> — tylko stamtąd iPhone pozwala dodać
            aplikację do ekranu początkowego. Chrome na iOS tej opcji nie ma.
          </p>
        )}
      </div>
      <button type="button" className="icon-btn" onClick={schowaj} aria-label="Ukryj podpowiedź">
        <Icon name="close" />
      </button>
    </aside>
  );
}
