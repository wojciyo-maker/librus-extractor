'use strict';
require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const path           = require('path');
const cron           = require('node-cron');
const { spawn }      = require('child_process');
const { parseAndSync }     = require('./parser');
const { sendNotification } = require('./email');

const SCRAPER = path.join(__dirname, '..', 'index.js');
const TZ      = 'Europe/Warsaw';

function runScraper() {
  return new Promise((resolve, reject) => {
    console.log('[cron] Running scraper (index.js)…');
    const child = spawn(process.execPath, [SCRAPER], { stdio: 'inherit' });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`index.js exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function scrapeAndSync(label) {
  console.log(`[cron] ${label} started`);
  try {
    await runScraper();
    const result = await parseAndSync();
    console.log(`[cron] ${label} synced. Changes: ${result.totalChanges}`);
    if (result.totalChanges > 0) {
      const emailResult = await sendNotification(result.changes, result.syncedAt);
      console.log(`[cron] ${label} email:`, emailResult);
    }
  } catch (err) {
    console.error(`[cron] ${label} error:`, err.message);
  }
}

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/account',       require('./routes/account'));
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
cron.schedule('0 8  * * *', () => scrapeAndSync('08:00'), { timezone: TZ });
cron.schedule('0 17 * * *', () => scrapeAndSync('17:00'), { timezone: TZ });

app.listen(PORT, () => {
  console.log(`Librus Dashboard running at http://localhost:${PORT}`);
});
