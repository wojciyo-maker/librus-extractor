import { useState, useEffect } from 'react';

function AnnCard({ ann }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (ann.content || '').length > 200;

  return (
    <div className="ann-card">
      <div className="ann-title">{ann.title}</div>
      <div className="ann-meta">{ann.userName} · {ann.date}</div>
      <div className={`ann-body ${!expanded && isLong ? 'collapsed' : ''}`}>
        {ann.content}
      </div>
      {isLong && (
        <button className="expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ Zwiń' : '▼ Rozwiń'}
        </button>
      )}
    </div>
  );
}

export default function Announcements() {
  const [data, setData]     = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/announcements').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="loading">Ładowanie ogłoszeń…</div>;

  const filtered = data.filter(a =>
    !search ||
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.content || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Ogłoszenia</h1>
        <p>{data.length} ogłoszeń</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Szukaj w ogłoszeniach…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', width: 320 }}
        />
      </div>

      {filtered.length === 0
        ? <p className="empty">Brak wyników.</p>
        : filtered.map(a => <AnnCard key={a.id} ann={a} />)
      }
    </div>
  );
}
