import type { Metadata } from 'next';
import Link from 'next/link';
import { wymagajWlasciciela } from '@/lib/panel-dostep';
import { getDziennik } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Dziennik',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const CZAS = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const OBSZARY = ['zamowienie', 'przesylka', 'rola', 'cena'];

export default async function Dziennik({
  searchParams,
}: {
  searchParams: Promise<{ obszar?: string }>;
}) {
  await wymagajWlasciciela('/panel/dziennik');

  const { obszar } = await searchParams;
  const wybrany = OBSZARY.includes(obszar ?? '') ? obszar : undefined;
  const wpisy = await getDziennik(wybrany);

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Dziennik</h1>
          <p className="muted">
            Zapis jest dopisywalny i nic więcej — wpisów nie da się poprawić ani skasować z panelu
            ani z API. Dziennik, który da się wyczyścić, nie jest dowodem.
          </p>
        </div>
      </div>

      <div className="pw-segmenty">
        <Link className="pw-segment" href="/panel/dziennik" aria-current={!wybrany || undefined}>
          wszystko
        </Link>
        {OBSZARY.map((o) => (
          <Link
            key={o}
            className="pw-segment"
            href={`/panel/dziennik?obszar=${o}`}
            aria-current={wybrany === o || undefined}
          >
            {o}
          </Link>
        ))}
      </div>

      {wpisy.length === 0 ? (
        <p className="muted pw-pusto">
          {wybrany
            ? 'Brak wpisów w tym obszarze.'
            : 'Nic jeszcze nie zapisano. Dziennik notuje zmiany od chwili wdrożenia — tego, co działo się wcześniej, nie odtworzy.'}
        </p>
      ) : (
        <div className="pw-tabela-kadr">
          <table className="pw-tabela">
            <thead>
              <tr>
                <th>Kiedy</th>
                <th>Kto</th>
                <th>Obszar</th>
                <th>Czego dotyczy</th>
                <th>Co się stało</th>
              </tr>
            </thead>
            <tbody>
              {wpisy.map((w) => (
                <tr key={w.id}>
                  <td className="num">{CZAS.format(new Date(w.czas))}</td>
                  <td>{w.kto}</td>
                  <td>
                    <span className="pw-stan">{w.obszar}</span>
                  </td>
                  <td>
                    {w.obszar === 'zamowienie' || w.obszar === 'przesylka' ? (
                      <Link
                        className="pw-wejscie"
                        href={`/panel/zamowienia/${encodeURIComponent(w.obiekt ?? '')}`}
                      >
                        {w.obiekt}
                      </Link>
                    ) : (
                      (w.obiekt ?? '—')
                    )}
                  </td>
                  <td>{w.opis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
