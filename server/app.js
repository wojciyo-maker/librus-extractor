'use strict';
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const { parseAndSync }     = require('./parser');
const { sendNotification } = require('./email');

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

// ── Daily auto-sync at 07:00 ──────────────────────────────────────────────────
cron.schedule('0 7 * * *', async () => {
  console.log('[cron] Starting scheduled sync...');
  try {
    const result = await parseAndSync();
    console.log(`[cron] Synced. Changes: ${result.totalChanges}`);
    if (result.totalChanges > 0) {
      const emailResult = await sendNotification(result.changes, result.syncedAt);
      console.log('[cron] Email:', emailResult);
    }
  } catch (err) {
    console.error('[cron] Sync error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Librus Dashboard running at http://localhost:${PORT}`);
});
