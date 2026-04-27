'use strict';
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const cron     = require('node-cron');
const { scrapeAndParseAll } = require('./scraper');

const TZ = 'Europe/Warsaw';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/account',       require('./routes/account'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/grades',        require('./routes/grades'));
app.use('/api/absences',      require('./routes/absences'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/timetable',     require('./routes/timetable'));
app.use('/api/sync',          require('./routes/sync'));
app.use('/api/settings',      require('./routes/settings'));

// ── Serve built React frontend ─────────────────────────────────────────────────
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  const index = path.join(CLIENT_DIST, 'index.html');
  res.sendFile(index, err => {
    if (err) res.status(404).send('Frontend not built. Run: npm run build');
  });
});

// ── Scheduled scrape: 08:00 and 17:00 CET/CEST ───────────────────────────────
function runScheduled(label) {
  console.log(`[cron] ${label} started`);
  scrapeAndParseAll()
    .then(r => console.log(`[cron] ${label} done. Total changes: ${r.totalChanges}`))
    .catch(e => console.error(`[cron] ${label} error:`, e.message));
}

cron.schedule('0 8  * * *', () => runScheduled('08:00'), { timezone: TZ });
cron.schedule('0 17 * * *', () => runScheduled('17:00'), { timezone: TZ });

app.listen(PORT, () => {
  console.log(`Librus Dashboard running at http://localhost:${PORT}`);
});
