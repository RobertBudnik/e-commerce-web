import type { MetadataRoute } from 'next';
import { MARKA } from '@/lib/dane-sklepu';

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
    name: `${MARKA.nazwa} — magazyn`,
    short_name: MARKA.nazwa,
    description: 'Kolejka pakowania i obsługa zamówień.',
    start_url: '/magazyn',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pl',
    // Tło magazynu z bloku `.mag` w globals.css, nie tło sklepu: skrót
    // z ekranu początkowego otwiera `/magazyn`, więc ekran startowy i pasek
    // stanu mają być w kolorze tego, co się pod nimi pojawi.
    //
    // Manifest przyjmuje jedną wartość, bez wariantu na motyw — ciemny
    // dokłada `themeColor` z `layout.tsx`, które przeglądarka czyta z meta
    // i które ma pierwszeństwo, gdy strona już stoi.
    background_color: '#f2f2f7',
    theme_color: '#f2f2f7',
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
