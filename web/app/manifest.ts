import type { MetadataRoute } from 'next';

/**
 * Manifest aplikacji. Po dodaniu do ekranu początkowego telefon uruchamia
 * sklep bez paska adresu — magazyn ma wyglądać jak aplikacja, a nie jak
 * strona otwarta w przeglądarce.
 *
 * `start_url` celuje w magazyn, nie w stronę główną: kto instaluje to na
 * telefonie, robi to do pakowania paczek, a nie do oglądania katalogu.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nordo — magazyn',
    short_name: 'Nordo',
    description: 'Kolejka pakowania i obsługa zamówień.',
    start_url: '/magazyn',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pl',
    background_color: '#faf9f7',
    theme_color: '#faf9f7',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
