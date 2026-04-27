import { useState, useEffect } from 'react';

const STUDENT_TYPE_LABELS = {
  primary_lower: 'Szkoła podstawowa (klasy 1–3)',
  primary_upper: 'Szkoła podstawowa (klasy 4–8)',
  secondary:     'Szkoła ponadpodstawowa',
};

const EMPTY_NEW_USER = { username: '', password: '', label: '', student_type: '' };

export default function Settings() {
  const [form, setForm]       = useState(null);
  const [msg, setMsg]         = useState(null);
  const [saving, setSaving]   = useState(false);
  const [users, setUsers]     = useState([]);
  const [userMsg, setUserMsg] = useState({});
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [addMsg, setAddMsg]   = useState(null);
  const [adding, setAdding]   = useState(false);

  function loadUsers() {
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {});
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleAddUser(e) {
    e.preventDefault();
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:     newUser.username,
          password:     newUser.password,
          label:        newUser.label || undefined,
          student_type: newUser.student_type || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd');
      setNewUser(EMPTY_NEW_USER);
      setAddMsg({ type: 'success', text: 'Użytkownik dodany.' });
      loadUsers();
    } catch (err) {
      setAddMsg({ type: 'error', text: err.message });
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteUser(id) {
    if (!window.confirm('Usunąć tego użytkownika?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) loadUsers();
    else {
      const data = await res.json();
      alert(data.error || 'Błąd usuwania');
    }
  }

  async function saveStudentType(userId, student_type) {
    setUserMsg(m => ({ ...m, [userId]: null }));
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_type }),
      });
      const data = await res.json();
      if (data.id) {
        setUsers(us => us.map(u => u.id === userId ? { ...u, student_type: data.student_type } : u));
        setUserMsg(m => ({ ...m, [userId]: 'ok' }));
      }
    } catch {
      setUserMsg(m => ({ ...m, [userId]: 'error' }));
    }
  }

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setForm({
        emailTo:             data.emailTo             || '',
        smtpHost:            data.smtpHost            || '',
        smtpPort:            data.smtpPort            || 587,
        smtpUser:            data.smtpUser            || '',
        smtpPass:            '',
        smtpFrom:            data.smtpFrom            || '',
        notifyGrades:        data.notifyGrades        ?? true,
        notifyAbsences:      data.notifyAbsences      ?? true,
        notifyHomework:      data.notifyHomework      ?? true,
        notifyAnnouncements: data.notifyAnnouncements ?? true,
        hasSmtpPass:         data.hasSmtpPass,
      });
    }).catch(() => {});
  }, []);

  if (!form) return <div className="loading">Ładowanie ustawień…</div>;

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body = { ...form };
      if (!body.smtpPass) delete body.smtpPass; // don't overwrite with empty
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) setMsg({ type: 'success', text: 'Ustawienia zapisane.' });
      else setMsg({ type: 'error', text: 'Błąd zapisu.' });
    } catch {
      setMsg({ type: 'error', text: 'Błąd sieci.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Ustawienia</h1>
        <p>Konfiguracja powiadomień e-mail</p>
      </div>

      <div className="card" style={{ marginBottom: 24, maxWidth: 560 }}>
        <div className="card-title">Użytkownicy</div>

        {/* Existing users */}
        {users.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: '0 0 130px', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.label || u.student_name || u.username}
                  {u.is_active && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>●</span>}
                </div>
                <select
                  style={{ flex: 1 }}
                  value={u.student_type || ''}
                  onChange={e => saveStudentType(u.id, e.target.value || null)}
                >
                  <option value="">— wybierz typ —</option>
                  {Object.entries(STUDENT_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {userMsg[u.id] === 'ok' && <span style={{ color: '#16a34a', fontSize: 13 }}>✓</span>}
                {userMsg[u.id] === 'error' && <span style={{ color: '#dc2626', fontSize: 13 }}>✗</span>}
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: '0 4px' }}
                  title="Usuń użytkownika"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add user form */}
        <form onSubmit={handleAddUser}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
            Dodaj użytkownika
          </div>
          {addMsg && (
            <div className={`banner banner-${addMsg.type}`} style={{ marginBottom: 10 }}>
              {addMsg.text}
            </div>
          )}
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Login Librus</label>
              <input type="text" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} placeholder="np. 12345678" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hasło</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Hasło Librus" required />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Etykieta (opcjonalna)</label>
              <input type="text" value={newUser.label} onChange={e => setNewUser(u => ({ ...u, label: e.target.value }))} placeholder="np. Helena" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Typ ucznia</label>
              <select value={newUser.student_type} onChange={e => setNewUser(u => ({ ...u, student_type: e.target.value }))}>
                <option value="">— wybierz typ —</option>
                {Object.entries(STUDENT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? '⏳ Dodawanie…' : '+ Dodaj użytkownika'}
          </button>
        </form>
      </div>

      <form onSubmit={save} style={{ maxWidth: 560 }}>
        {msg && (
          <div className={`banner banner-${msg.type}`} style={{ marginBottom: 16 }}>
            {msg.text}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Powiadomienia e-mail</div>

          <div className="form-group">
            <label>Adres e-mail odbiorcy</label>
            <input type="email" value={form.emailTo} onChange={e => set('emailTo', e.target.value)} placeholder="rodzic@example.com" />
          </div>

          <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Powiadamiaj o</div>
          {[
            ['notifyGrades',        'Nowe oceny'],
            ['notifyAbsences',      'Nowe nieobecności'],
            ['notifyHomework',      'Nowe zadania domowe'],
            ['notifyAnnouncements', 'Nowe ogłoszenia'],
          ].map(([key, label]) => (
            <div key={key} className="form-group checkbox">
              <input type="checkbox" id={key} checked={form[key]} onChange={e => set(key, e.target.checked)} />
              <label htmlFor={key}>{label}</label>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Konfiguracja SMTP</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Możesz też ustawić przez zmienne środowiskowe w pliku <code>.env</code> (mają pierwszeństwo).
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>Host SMTP</label>
              <input type="text" value={form.smtpHost} onChange={e => set('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input type="number" value={form.smtpPort} onChange={e => set('smtpPort', parseInt(e.target.value))} placeholder="587" />
            </div>
          </div>

          <div className="form-group">
            <label>Użytkownik (login)</label>
            <input type="text" value={form.smtpUser} onChange={e => set('smtpUser', e.target.value)} placeholder="twoj@gmail.com" />
          </div>

          <div className="form-group">
            <label>Hasło {form.hasSmtpPass && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(zapisane – zostaw puste, aby nie zmieniać)</span>}</label>
            <input type="password" value={form.smtpPass} onChange={e => set('smtpPass', e.target.value)} placeholder={form.hasSmtpPass ? '••••••••' : 'Hasło lub App Password'} />
          </div>

          <div className="form-group">
            <label>Nadawca (From)</label>
            <input type="text" value={form.smtpFrom} onChange={e => set('smtpFrom', e.target.value)} placeholder="Librus Dashboard <twoj@gmail.com>" />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '⏳ Zapisywanie…' : '💾 Zapisz ustawienia'}
        </button>
      </form>
    </div>
  );
}
