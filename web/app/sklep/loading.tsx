import { GridSkeleton } from '@/components/ui/GridSkeleton';

/** Widok na czas pobierania katalogu — ta sama ramka co gotowa strona. */
export default function Loading() {
  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Katalog</span>
          <h1>Sklep</h1>
        </div>
      </div>
      <GridSkeleton count={8} />
    </main>
  );
}
