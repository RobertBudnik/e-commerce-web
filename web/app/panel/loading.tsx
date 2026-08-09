import { StosSzkieletu } from '@/components/ui/StosSzkieletu';

/** Widok na czas pobierania katalogu do panelu. */
export default function Loading() {
  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Panel produktów</h1>
        </div>
      </div>
      <StosSzkieletu wierszy={3} />
    </main>
  );
}
