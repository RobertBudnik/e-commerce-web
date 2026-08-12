import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Port inny niż 3000 — tam siedzi sklep na Next.js i oba bywają uruchomione naraz.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180 },
});
