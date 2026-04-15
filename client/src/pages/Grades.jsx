import { useState, useEffect } from 'react';

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

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  if (!text) return children;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', fontSize: 11, padding: '6px 10px',
          borderRadius: 6, whiteSpace: 'pre-wrap', maxWidth: 260, zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,.2)', lineHeight: 1.5
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

export default function Grades() {
  const [subjects, setSubjects] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeSem, setActiveSem] = useState(1);

  useEffect(() => {
    fetch('/api/grades').then(r => r.json()).then(data => {
      setSubjects(data);
      if (data?.length) setSelected(data[0].name);
    }).catch(() => {});
  }, []);

  if (!subjects) return <div className="loading">Ładowanie ocen…</div>;
  if (!subjects.length) return <div className="empty">Brak ocen w bazie. Uruchom synchronizację.</div>;

  const subj = subjects.find(s => s.name === selected);
  const sem  = subj?.semesters.find(s => s.semester === activeSem);

  return (
    <div>
      <div className="page-header">
        <h1>Oceny</h1>
        <p>Kliknij na ocenę, aby zobaczyć szczegóły</p>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Subject list */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {subjects.map(s => {
            const s1 = s.semesters.find(x => x.semester === 1);
            const s2 = s.semesters.find(x => x.semester === 2);
            return (
              <button key={s.name}
                onClick={() => setSelected(s.name)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px',
                  marginBottom: 4, border: '1px solid var(--border)', borderRadius: 8,
                  background: selected === s.name ? 'var(--primary-light)' : 'var(--surface)',
                  cursor: 'pointer', fontSize: 13,
                  color: selected === s.name ? 'var(--primary)' : 'var(--text)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {s1?.average != null && <span className={`grade-badge ${gradeClass(s1.average)}`} style={{ fontSize: 10, padding: '1px 5px' }}>{s1.average.toFixed(1)}</span>}
                  {s2?.average != null && <span className={`grade-badge ${gradeClass(s2.average)}`} style={{ fontSize: 10, padding: '1px 5px' }}>{s2.average.toFixed(1)}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grade detail */}
        <div style={{ flex: 1 }}>
          {subj && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{subj.name}</h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  {subj.semesters.map(s => (
                    <button key={s.semester}
                      className={`btn ${activeSem === s.semester ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setActiveSem(s.semester)}
                      style={{ padding: '4px 12px', fontSize: 12 }}>
                      Sem. {s.semester}
                    </button>
                  ))}
                </div>
              </div>

              {sem ? (
                <>
                  {sem.average != null && (
                    <div className="banner banner-info" style={{ marginBottom: 14 }}>
                      Średnia ważona: <strong>{sem.average.toFixed(2)}</strong>
                      <span style={{ fontSize: 12, marginLeft: 8, opacity: .8 }}>
                        ({sem.grades.filter(g => g.countsForAverage).length} ocen liczy do średniej)
                      </span>
                    </div>
                  )}

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ocena</th>
                          <th>Kategoria</th>
                          <th>Data</th>
                          <th>Nauczyciel</th>
                          <th>Waga</th>
                          <th>Do śr.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sem.grades.map(g => (
                          <tr key={g.id}>
                            <td>
                              <Tooltip text={g.comment}>
                                <span className={`grade-badge ${gradeClass(g.value)}`}>{g.value}</span>
                              </Tooltip>
                            </td>
                            <td>{g.category || '–'}</td>
                            <td style={{ color: 'var(--muted)', fontSize: 12 }}>{g.date || '–'}</td>
                            <td style={{ color: 'var(--muted)', fontSize: 12 }}>{g.teacher || '–'}</td>
                            <td style={{ color: 'var(--muted)', textAlign: 'center' }}>{g.weight ?? '–'}</td>
                            <td style={{ textAlign: 'center' }}>
                              {g.countsForAverage
                                ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓</span>
                                : <span style={{ color: '#9ca3af' }}>–</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <p className="empty" style={{ padding: 8 }}>Brak ocen w tym semestrze.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
