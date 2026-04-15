import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard     from './pages/Dashboard.jsx';
import Grades        from './pages/Grades.jsx';
import Absences      from './pages/Absences.jsx';
import Announcements from './pages/Announcements.jsx';
import Timetable     from './pages/Timetable.jsx';
import Settings      from './pages/Settings.jsx';

const NAV = [
  { to: '/',              icon: '🏠', label: 'Dashboard'    },
  { to: '/grades',        icon: '🎓', label: 'Oceny'        },
  { to: '/timetable',     icon: '📅', label: 'Plan lekcji'  },
  { to: '/absences',      icon: '📋', label: 'Nieobecności' },
  { to: '/announcements', icon: '📣', label: 'Ogłoszenia'   },
  { to: '/settings',      icon: '⚙️',  label: 'Ustawienia'  },
];

export default function App() {
  const [account, setAccount] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  useEffect(() => {
    fetch('/api/account').then(r => r.json()).then(setAccount).catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncMsg(`Zsynchronizowano. Zmian: ${data.totalChanges}`);
      // Refresh account after sync
      fetch('/api/account').then(r => r.json()).then(setAccount).catch(() => {});
    } catch (e) {
      setSyncMsg(`Błąd: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">📚 Librus</div>
        {account && (
          <div className="sidebar-student">
            <strong>{account.student_name}</strong>
            {account.student_class}
          </div>
        )}
        <nav>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-sync">
          {syncMsg && (
            <div className={`banner ${syncMsg.startsWith('Błąd') ? 'banner-error' : 'banner-success'}`} style={{ marginBottom: 8, fontSize: 12 }}>
              {syncMsg}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSync} disabled={syncing}>
            {syncing ? '⏳ Synchronizacja…' : '🔄 Synchronizuj'}
          </button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/grades"        element={<Grades />} />
          <Route path="/timetable"     element={<Timetable />} />
          <Route path="/absences"      element={<Absences />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/settings"      element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
