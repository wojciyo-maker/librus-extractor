'use strict';
const express = require('express');
const { parseAndSync } = require('../parser');
const { sendNotification } = require('../email');
const { getDb } = require('../db');
const router = express.Router();

// POST /api/sync  — parse XML, upsert DB, send email if changes
router.post('/', async (req, res) => {
  try {
    const result = await parseAndSync();
    let emailResult = null;
    if (result.totalChanges > 0) {
      emailResult = await sendNotification(result.changes, result.syncedAt).catch(e => ({ error: e.message }));
    }
    res.json({ ...result, email: emailResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/log  — last 20 sync runs
router.get('/log', (req, res) => {
  const rows = getDb().prepare(
    'SELECT id, synced_at, changes_json FROM sync_log ORDER BY id DESC LIMIT 20'
  ).all();
  res.json(rows.map(r => ({
    id:        r.id,
    syncedAt:  r.synced_at,
    changes:   JSON.parse(r.changes_json || '{}'),
  })));
});

module.exports = router;
