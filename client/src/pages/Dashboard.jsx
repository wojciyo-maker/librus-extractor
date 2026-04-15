import { useState, useEffect } from 'react';

function useFetch(url) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(url).then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [url]);
  return { data, loading };
}

function gradeClass(v) {
  const n = parseFloat(v);
  if (n >= 6) return 'grade-6';
  if (n >= 5) return 'grade-5';
  if (n >= 4) return 'grade-4';
  if (n >= 3) return 'grade-3';
  if (n >= 2) return 'grade-2';
  if (n === 1) return 'grade-1';
  return 'grade-x';
}

export default function Dashboard() {
  const { data: account }       = useFetch('/api/account');
  const { data: grades }        = useFetch('/api/grades');
  const { data: absences }      = useFetch('/api/absences');
  const { data: announcements } = useFetch('/api/announcements');
  const { data: syncLog }       = useFetch('/api/sync/log');

  // Flatten recent grades across all subjects
  const recentGrades = grades
    ? grades.flatMap(s => s.semesters.flatMap(sem => sem.grades.map(g => ({ ...g, subject: s.name }))))
        .filter(g => g.date)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 8)
    : [];

  const totalAbsences  = absences?.total ?? 0;
  const totalGrades    = grades ? grades.flatMap(s => s.semesters.flatMap(sem => sem.grades)).length : 0;
  const lastSync       = syncLog?.[0]?.syncedAt ? new Date(syncLog[0].syncedAt).toLocaleString('pl-PL') : '—';

  const recentAnnouncements = (announcements || []).slice(0, 3);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        {account && <p>Witaj, {account.student_name} · Klasa {account.student_class}</p>}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalGrades}</div>
          <div className="stat-label">Ocen w bazie</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalAbsences}</div>
          <div className="stat-label">Nieobecności</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{grades?.length ?? 0}</div>
          <div className="stat-label">Przedmiotów</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 14, paddingTop: 6 }}>{lastSync}</div>
          <div className="stat-label">Ostatnia synchronizacja</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent grades */}
        <div className="card">
          <div className="card-title">Ostatnie oceny</div>
          {recentGrades.length === 0
            ? <p className="empty" style={{ padding: 0 }}>Brak ocen. Uruchom synchronizację.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Przedmiot</th><th>Ocena</th><th>Kategoria</th><th>Data</th></tr></thead>
                  <tbody>
                    {recentGrades.map(g => (
                      <tr key={g.id}>
                        <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.subject}</td>
                        <td><span className={`grade-badge ${gradeClass(g.value)}`}>{g.value}</span></td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{g.category || '–'}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{g.date || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Recent announcements */}
        <div className="card">
          <div className="card-title">Ostatnie ogłoszenia</div>
          {recentAnnouncements.length === 0
            ? <p className="empty" style={{ padding: 0 }}>Brak ogłoszeń.</p>
            : recentAnnouncements.map(a => (
              <div key={a.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{a.userName} · {a.date}</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 6, maxHeight: 52, overflow: 'hidden', lineHeight: 1.5 }}>{a.content}</div>
              </div>
            ))}
        </div>

        {/* Absences summary */}
        <div className="card">
          <div className="card-title">Ostatnie nieobecności</div>
          {!absences?.byDate?.length
            ? <p className="empty" style={{ padding: 0 }}>Brak nieobecności.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Lekcje</th><th>Typ</th></tr></thead>
                  <tbody>
                    {absences.byDate.slice(0, 6).map(({ date, lessons }) => (
                      <tr key={date}>
                        <td>{date}</td>
                        <td>{lessons.map(l => l.lessonNum).join(', ')}</td>
                        <td>{[...new Set(lessons.map(l => l.type))].map(t => (
                          <span key={t} className={`abs-badge abs-${t}`} style={{ marginRight: 4 }}>{t}</span>
                        ))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Averages by subject */}
        <div className="card">
          <div className="card-title">Średnie ocen</div>
          {!grades?.length
            ? <p className="empty" style={{ padding: 0 }}>Brak danych.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Przedmiot</th><th>Sem. 1</th><th>Sem. 2</th></tr></thead>
                  <tbody>
                    {grades.map(s => {
                      const s1 = s.semesters.find(x => x.semester === 1);
                      const s2 = s.semesters.find(x => x.semester === 2);
                      return (
                        <tr key={s.name}>
                          <td>{s.name}</td>
                          <td>{s1?.average != null ? <span className={`grade-badge ${gradeClass(s1.average)}`}>{s1.average.toFixed(2)}</span> : '–'}</td>
                          <td>{s2?.average != null ? <span className={`grade-badge ${gradeClass(s2.average)}`}>{s2.average.toFixed(2)}</span> : '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
