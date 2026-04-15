import { useState, useEffect } from 'react';

const TYPE_LABELS = { nb: 'Nieobecność', sp: 'Spóźnienie', u: 'Usprawiedliwione', zw: 'Zwolnione' };

function AbsBadge({ type }) {
  const cls = ['nb', 'sp', 'u', 'zw'].includes(type) ? type : 'other';
  return <span className={`abs-badge abs-${cls}`}>{TYPE_LABELS[type] || type}</span>;
}

export default function Absences() {
  const [data, setData]   = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/absences').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="loading">Ładowanie nieobecności…</div>;

  const rows = (data.byDate || []).filter(({ date }) => !filter || date.includes(filter));

  // Count by type
  const typeCounts = {};
  (data.byDate || []).forEach(({ lessons }) =>
    lessons.forEach(l => { typeCounts[l.type] = (typeCounts[l.type] || 0) + 1; })
  );

  return (
    <div>
      <div className="page-header">
        <h1>Nieobecności</h1>
        <p>Łącznie: {data.total} wpisów</p>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <div key={type} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AbsBadge type={type} />
            <strong>{count}</strong>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Filtruj po dacie (np. 2026-04)"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', width: 240 }}
          />
        </div>

        {rows.length === 0
          ? <p className="empty">Brak nieobecności.</p>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Lekcja 1</th><th>Lekcja 2</th><th>Lekcja 3</th><th>Lekcja 4</th>
                    <th>Lekcja 5</th><th>Lekcja 6</th><th>Lekcja 7</th><th>Lekcja 8</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ date, lessons }) => {
                    const byLesson = {};
                    for (const l of lessons) byLesson[l.lessonNum] = l.type;
                    return (
                      <tr key={date}>
                        <td style={{ fontWeight: 600 }}>{date}</td>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <td key={n} style={{ textAlign: 'center' }}>
                            {byLesson[n] ? <AbsBadge type={byLesson[n]} /> : <span style={{ color: 'var(--border)' }}>·</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
