# Standardy Nordo

Zestaw list kontrolnych, po których idziemy przy zmianach. Nie są to kopie
cudzych dokumentów — każda pozycja jest przepisana pod ten projekt, z linkiem
do źródła, żeby dało się sprawdzić, czy reguła nadal obowiązuje.

Stan na sierpień 2026.

| plik | o czym |
|---|---|
| [supabase.md](supabase.md) | sesja, RLS, granty funkcji, realtime, błędy sieci |
| [vercel.md](vercel.md) | wdrożenie, sekrety, limity zapytań, Server Actions |
| [ios.md](ios.md) | powłoka natywna, App Store, prywatność, safe area |
| [dostepnosc-i-ruch.md](dostepnosc-i-ruch.md) | WCAG 2.2 AA, cele dotykowe, kontrast, animacje |

## Jak z tego korzystać

Przed wdrożeniem większej zmiany przejdź listę z pliku, którego zmiana dotyka.
Pozycje oznaczone **[auto]** ma sprawdzać CI albo skrypt — jeśli nie sprawdza,
to jest to dług, nie decyzja.

Reguły wyglądu i ruchu interfejsu są osobno, w skillu `nordo-design`.
Ten katalog opisuje zgodność i bezpieczeństwo, nie estetykę.
