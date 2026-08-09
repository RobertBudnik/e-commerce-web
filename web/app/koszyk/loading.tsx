import { StosSzkieletu } from '@/components/ui/StosSzkieletu';

/** Widok na czas pobierania danych do koszyka. */
export default function Loading() {
  return (
    <main className="container section">
      <div className="cart-head">
        <h1>Koszyk</h1>
      </div>
      <StosSzkieletu wierszy={2} />
    </main>
  );
}
