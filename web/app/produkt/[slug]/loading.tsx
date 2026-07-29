/** Szkielet karty produktu: kadr zdjęcia i kilka linii opisu. */
export default function Loading() {
  return (
    <main className="container">
      <div className="product" style={{ marginTop: 32 }}>
        <div className="skeleton">
          <div className="skeleton-box skeleton-media" />
        </div>
        <div className="skeleton" style={{ paddingTop: 12 }}>
          <div className="skeleton-box skeleton-line w-40" />
          <div className="skeleton-box skeleton-line" style={{ height: 28, marginTop: 16 }} />
          <div className="skeleton-box skeleton-line w-70" />
          <div className="skeleton-box skeleton-line w-40" style={{ marginTop: 24 }} />
          <div className="skeleton-box skeleton-line w-70" />
          <div className="skeleton-box skeleton-line w-70" />
        </div>
      </div>
    </main>
  );
}
