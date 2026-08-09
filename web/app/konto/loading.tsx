import { StosSzkieletu } from '@/components/ui/StosSzkieletu';

/**
 * Widok na czas pobierania profilu i zamówień.
 *
 * Ta sama ramka co gotowa strona — nagłówek stoi w miejscu, zmienia się
 * wyłącznie treść pod nim. Szkielet, który przestawia układ po dojściu
 * danych, jest gorszy od pustki: oko zdąży złapać pozycję i traci ją.
 */
export default function Loading() {
  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Twoje konto</span>
          <h1>Konto</h1>
        </div>
      </div>
      <StosSzkieletu wierszy={3} />
    </main>
  );
}
