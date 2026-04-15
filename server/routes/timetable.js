'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM timetable ORDER BY lesson_num').all();

  const byDay = {};
  for (const day of DAY_ORDER) byDay[day] = [];

  for (const row of rows) {
    if (!byDay[row.day_of_week]) continue;
    byDay[row.day_of_week].push({
      lessonNum: row.lesson_num,
      subject:   row.subject,
      teacher:   row.teacher,
      room:      row.room,
      timeSlot:  row.time_slot,
    });
  }

  // All unique lesson numbers
  const allLessons = [...new Set(rows.map(r => r.lesson_num))].sort((a, b) => a - b);

  res.json({ days: DAY_ORDER, lessons: allLessons, byDay });
});

module.exports = router;
