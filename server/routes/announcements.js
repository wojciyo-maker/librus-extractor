'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = getDb().prepare(
    'SELECT * FROM announcements ORDER BY date DESC'
  ).all();
  res.json(rows.map(r => ({
    id:          r.id,
    title:       r.title,
    userName:    r.user_name,
    date:        r.date,
    content:     r.content,
    firstSeenAt: r.first_seen_at,
  })));
});

module.exports = router;
