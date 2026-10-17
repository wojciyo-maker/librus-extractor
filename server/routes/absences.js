'use strict';
const express = require('express');
const { getDb, getActiveUserId } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const userId = getActiveUserId();
  const rows = getDb().prepare(
    'SELECT * FROM absences WHERE user_id = ? ORDER BY date DESC, lesson_num'
  ).all(userId);

  // Group by date
  const byDate = {};
  for (const row of rows) {
    if (!byDate[row.date]) byDate[row.date] = [];
    byDate[row.date].push({ id: row.id, lessonNum: row.lesson_num, type: row.type, firstSeenAt: row.first_seen_at });
  }

  const result = Object.entries(byDate).map(([date, lessons]) => ({ date, lessons }));
  const total = rows.length;
  res.json({ total, byDate: result });
});

module.exports = router;
