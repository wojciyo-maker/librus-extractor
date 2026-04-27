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
  const [users, setUsers] = useState([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  function loadAccount() {
    fetch('/api/account').then(r => r.json()).then(setAccount).catch(() => {});
  }

  function loadUsers() {
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {});
  }

  useEffect(() => {
    loadAccount();
    loadUsers();
  }, []);

  async function handleUserSwitch(id) {
    await fetch(`/api/users/${id}/activate`, { method: 'POST' });
    loadUsers();
    loadAccount();
    setDataVersion(v => v + 1);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncMsg(`Zsynchronizowano. Zmian: ${data.totalChanges}`);
      // Refresh account and all data pages after sync
      loadAccount();
      setDataVersion(v => v + 1);
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
        <div className="sidebar-student">
          {account && (
            <>
              <strong>{account.student_name}</strong>
              <span className="sidebar-student-class">{account.student_class}</span>
            </>
          )}
          {users.length > 1 && (
            <div className="user-switcher">
              <select
                value={users.find(u => u.is_active)?.id ?? ''}
                onChange={e => handleUserSwitch(Number(e.target.value))}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.label || u.student_name || u.username}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
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

      <main className="main" key={dataVersion}>
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
