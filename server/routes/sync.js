'use strict';
const express = require('express');
const { scrapeAndParseAll } = require('../scraper');
const { getDb } = require('../db');
const router = express.Router();

// POST /api/sync — scrape Librus for ALL users, then parse and upsert each into the DB
router.post('/', async (req, res) => {
  try {
    const result = await scrapeAndParseAll();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/log — last 20 sync runs
router.get('/log', (req, res) => {
  const rows = getDb().prepare(
    'SELECT id, user_id, synced_at, changes_json FROM sync_log ORDER BY id DESC LIMIT 20'
  ).all();
  res.json(rows.map(r => ({
    id:       r.id,
    userId:   r.user_id,
    syncedAt: r.synced_at,
    changes:  JSON.parse(r.changes_json || '{}'),
  })));
});

module.exports = router;
