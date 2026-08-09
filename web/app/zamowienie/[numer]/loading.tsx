import { StosSzkieletu } from '@/components/ui/StosSzkieletu';

/** Widok na czas pobierania zamówienia po powrocie z płatności. */
export default function Loading() {
  return (
    <main className="container section">
      <div className="order-done">
        <h1>Zamówienie przyjęte</h1>
        <p className="lede">Sprawdzam status…</p>
      </div>
      <StosSzkieletu wierszy={2} />
    </main>
  );
}
