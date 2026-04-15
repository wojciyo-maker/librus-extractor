import { useState, useEffect } from 'react';

const DAY_PL = { Monday: 'Poniedziałek', Tuesday: 'Wtorek', Wednesday: 'Środa', Thursday: 'Czwartek', Friday: 'Piątek' };

export default function Timetable() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/timetable').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="loading">Ładowanie planu lekcji…</div>;
  if (!data.lessons?.length) return <div className="empty">Brak planu lekcji. Uruchom synchronizację.</div>;

  const { days, lessons, byDay } = data;

  // Grid: [lesson x day]
  return (
    <div>
      <div className="page-header">
        <h1>Plan lekcji</h1>
        <p>Bieżący tygodniowy plan zajęć</p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `60px repeat(${days.length}, minmax(140px, 1fr))`,
          gap: 4,
          minWidth: 700
        }}>
          {/* Header row */}
          <div className="tt-cell header" />
          {days.map(d => (
            <div key={d} className="tt-cell header" style={{ justifyContent: 'center' }}>
              {DAY_PL[d] || d}
            </div>
          ))}

          {/* Lesson rows */}
          {lessons.map(lessonNum => (
            <>
              {/* Lesson number */}
              <div key={`num-${lessonNum}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16, color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
              }}>
                {lessonNum}
              </div>

              {days.map(day => {
                const cell = (byDay[day] || []).find(c => c.lessonNum === lessonNum);
                if (!cell) return <div key={`${day}-${lessonNum}`} className="tt-empty" />;
                return (
                  <div key={`${day}-${lessonNum}`} className="tt-cell">
                    <div className="tt-subject">{cell.subject}</div>
                    {cell.teacher && <div className="tt-teacher">{cell.teacher}</div>}
                    {cell.room    && <div className="tt-room">Sala {cell.room}</div>}
                    {cell.timeSlot && <div className="tt-time">{cell.timeSlot}</div>}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
