import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

/**
 * Konfiguracja płaska (ESLint 9), a nie `next lint`.
 *
 * `next lint` jest wycofywane w Next 16 i wchodziło w interaktywny kreator,
 * gdy konfiguracji nie było — przez co `npm run lint` nie dawał się puścić
 * ani lokalnie, ani w CI. Zestaw reguł zostaje ten sam: `eslint-config-next`
 * niesie wtyczki React Hooks i next/core-web-vitals, tylko wczytujemy je
 * przez FlatCompat, bo sam pakiet jest jeszcze w starym formacie.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const konfiguracja = [
  {
    // Wyniki buildów i przebiegów testowych nie są kodem źródłowym.
    ignores: [
      '.next/**',
      '.next-build/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Zmienna nieużywana to zwykle zapomniany kawałek, ale argument
      // z podkreśleniem bywa świadomym „to pole mnie nie interesuje".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default konfiguracja;
