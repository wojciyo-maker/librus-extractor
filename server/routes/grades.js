'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = getDb().prepare(
    'SELECT * FROM grades ORDER BY subject, semester, date'
  ).all();

  // Group: subject → semester → grades[]
  const map = {};
  for (const row of rows) {
    if (!map[row.subject]) map[row.subject] = {};
    if (!map[row.subject][row.semester]) map[row.subject][row.semester] = [];
    map[row.subject][row.semester].push({
      id:               row.id,
      value:            row.value,
      category:         row.category,
      date:             row.date,
      teacher:          row.teacher,
      weight:           row.weight,
      countsForAverage: !!row.counts_for_average,
      comment:          row.comment,
      firstSeenAt:      row.first_seen_at,
    });
  }

  const subjects = Object.entries(map).map(([name, semMap]) => {
    const semesters = Object.entries(semMap).map(([sem, grades]) => {
      const countable = grades.filter(g => g.countsForAverage && !isNaN(parseFloat(g.value)));
      let average = null;
      if (countable.length > 0) {
        const wSum = countable.reduce((s, g) => s + parseFloat(g.value) * (g.weight ?? 1), 0);
        const wTot = countable.reduce((s, g) => s + (g.weight ?? 1), 0);
        average = wTot > 0 ? Math.round((wSum / wTot) * 100) / 100 : null;
      }
      return { semester: parseInt(sem), grades, average };
    }).sort((a, b) => a.semester - b.semester);
    return { name, semesters };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  res.json(subjects);
});

module.exports = router;
