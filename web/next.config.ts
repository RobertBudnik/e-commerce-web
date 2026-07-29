import type { NextConfig } from 'next';

/**
 * Zdjęcia produktów leżą w Supabase Storage, więc `next/image` musi mieć
 * zgodę na ten host. Adres bierzemy ze zmiennej — lokalnie to 127.0.0.1,
 * na produkcji domena projektu.
 */
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321');

const nextConfig: NextConfig = {
  experimental: {
    // Zdjęcia produktów idą przez Server Action; domyślny limit 1 MB
    // odrzucałby wszystko powyżej miniatury. Kubełek i tak tnie na 5 MB.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port || undefined,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
