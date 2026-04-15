'use strict';
const nodemailer = require('nodemailer');
const { getDb } = require('./db');

function getSmtpConfig() {
  const db = getDb();
  const cfg = db.prepare('SELECT * FROM notifications_config WHERE id = 1').get() || {};
  return {
    host:  process.env.SMTP_HOST  || cfg.smtp_host,
    port:  parseInt(process.env.SMTP_PORT  || cfg.smtp_port || 587),
    user:  process.env.SMTP_USER  || cfg.smtp_user,
    pass:  process.env.SMTP_PASS  || cfg.smtp_pass,
    from:  process.env.SMTP_FROM  || cfg.smtp_from,
    to:    process.env.NOTIFY_EMAIL || cfg.email_to,
    notifyGrades:        cfg.notify_grades        !== 0,
    notifyAbsences:      cfg.notify_absences      !== 0,
    notifyHomework:      cfg.notify_homework       !== 0,
    notifyAnnouncements: cfg.notify_announcements  !== 0,
  };
}

function gradeColor(value) {
  const n = parseFloat(value);
  if (n >= 5) return '#16a34a';
  if (n >= 4) return '#2563eb';
  if (n >= 3) return '#d97706';
  if (n >= 2) return '#dc2626';
  if (n === 1) return '#7f1d1d';
  return '#6b7280';
}

function buildHtml(changes, syncedAt) {
  const date = new Date(syncedAt).toLocaleString('pl-PL');
  let body = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <div style="background:#4f46e5;color:#fff;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">📚 Librus — nowe zmiany</h1>
        <p style="margin:4px 0 0;opacity:.8;font-size:13px">Synchronizacja: ${date}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;background:#fff">
  `;

  if (changes.grades?.length) {
    body += `<h2 style="font-size:16px;color:#4f46e5;margin:0 0 12px">🎓 Nowe oceny (${changes.grades.length})</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px">`;
    body += '<tr style="background:#f3f4f6;font-size:12px;color:#6b7280"><th style="padding:6px 8px;text-align:left">Przedmiot</th><th style="padding:6px 8px;text-align:left">Sem.</th><th style="padding:6px 8px;text-align:left">Ocena</th><th style="padding:6px 8px;text-align:left">Data</th></tr>';
    for (const g of changes.grades) {
      body += `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:6px 8px">${g.subject}</td>
        <td style="padding:6px 8px">${g.semester}</td>
        <td style="padding:6px 8px"><span style="background:${gradeColor(g.value)};color:#fff;padding:2px 8px;border-radius:9999px;font-weight:600">${g.value}</span></td>
        <td style="padding:6px 8px;color:#6b7280;font-size:13px">${g.date || '–'}</td>
      </tr>`;
    }
    body += '</table>';
  }

  if (changes.absences?.length) {
    body += `<h2 style="font-size:16px;color:#dc2626;margin:0 0 12px">📋 Nowe nieobecności (${changes.absences.length})</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px">`;
    body += '<tr style="background:#f3f4f6;font-size:12px;color:#6b7280"><th style="padding:6px 8px;text-align:left">Data</th><th style="padding:6px 8px;text-align:left">Lekcja</th><th style="padding:6px 8px;text-align:left">Typ</th></tr>';
    for (const a of changes.absences) {
      body += `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 8px">${a.date}</td><td style="padding:6px 8px">${a.lessonNum}</td><td style="padding:6px 8px">${a.type}</td></tr>`;
    }
    body += '</table>';
  }

  if (changes.homework?.length) {
    body += `<h2 style="font-size:16px;color:#d97706;margin:0 0 12px">📝 Nowe zadania (${changes.homework.length})</h2><ul style="margin:0 0 20px;padding-left:20px">`;
    for (const h of changes.homework) {
      body += `<li style="margin-bottom:4px">${h.subject || '–'}: ${h.title || '–'}</li>`;
    }
    body += '</ul>';
  }

  if (changes.announcements?.length) {
    body += `<h2 style="font-size:16px;color:#059669;margin:0 0 12px">📣 Nowe ogłoszenia (${changes.announcements.length})</h2><ul style="margin:0 0 20px;padding-left:20px">`;
    for (const a of changes.announcements) {
      body += `<li style="margin-bottom:4px"><strong>${a.title}</strong> <span style="color:#6b7280;font-size:12px">(${a.date})</span></li>`;
    }
    body += '</ul>';
  }

  body += `
        <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;border-top:1px solid #f3f4f6;padding-top:12px">
          Wygenerowano przez Librus Dashboard
        </p>
      </div>
    </div>
  `;
  return body;
}

async function sendNotification(changes, syncedAt) {
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass || !cfg.to) return { skipped: true, reason: 'SMTP not configured' };

  const filtered = {
    grades:        cfg.notifyGrades        ? changes.grades        : [],
    absences:      cfg.notifyAbsences      ? changes.absences      : [],
    homework:      cfg.notifyHomework      ? changes.homework      : [],
    announcements: cfg.notifyAnnouncements ? changes.announcements : [],
  };
  const total = Object.values(filtered).reduce((s, a) => s + a.length, 0);
  if (total === 0) return { skipped: true, reason: 'No changes to report' };

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transporter.sendMail({
    from:    cfg.from || cfg.user,
    to:      cfg.to,
    subject: `Librus – ${total} nowe zmiany (${new Date(syncedAt).toLocaleDateString('pl-PL')})`,
    html:    buildHtml(filtered, syncedAt),
  });

  return { sent: true, to: cfg.to, total };
}

module.exports = { sendNotification };
