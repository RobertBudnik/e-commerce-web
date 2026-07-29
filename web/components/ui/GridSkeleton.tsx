/**
 * Szkielety na czas pobierania katalogu. Trzymają wysokość siatki, więc
 * treść nie podskakuje, gdy dane dojadą.
 */
export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton" key={i}>
          <div className="skeleton-box skeleton-media" />
          <div className="skeleton-box skeleton-line w-40" />
          <div className="skeleton-box skeleton-line w-70" />
          <div className="skeleton-box skeleton-line w-40" />
        </div>
      ))}
    </div>
  );
}
