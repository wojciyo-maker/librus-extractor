'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

const VALID_STUDENT_TYPES = ['primary_lower', 'primary_upper', 'secondary'];

// GET /api/users — list all users with active flag and student name from account table
router.get('/', (req, res) => {
  const db = getDb();
  const cfg = db.prepare('SELECT active_user_id FROM app_config WHERE id = 1').get();
  const activeId = cfg ? cfg.active_user_id : null;
  const users = db.prepare(`
    SELECT s.id, s.username, s.label, s.student_type, a.student_name
    FROM secrets s
    LEFT JOIN account a ON a.id = s.id
    ORDER BY s.id
  `).all();
  res.json(users.map(u => ({ ...u, is_active: u.id === activeId })));
});

// POST /api/users/:id/activate — switch active user
router.post('/:id/activate', (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const user = db.prepare('SELECT id FROM secrets WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE app_config SET active_user_id = ? WHERE id = 1').run(id);
  res.json({ active_user_id: id });
});

// POST /api/users — add a new user
router.post('/', (req, res) => {
  const { username, password, label, student_type } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (student_type && !VALID_STUDENT_TYPES.includes(student_type)) {
    return res.status(400).json({ error: `student_type must be one of: ${VALID_STUDENT_TYPES.join(', ')}` });
  }
  const db = getDb();
  const nextId = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM secrets').get().next_id;
  db.prepare('INSERT INTO secrets (id, username, password, label, student_type) VALUES (?, ?, ?, ?, ?)').run(
    nextId, username, password, label || null, student_type || null
  );
  res.status(201).json({ id: nextId, username, label: label || null, student_type: student_type || null, is_active: false });
});

// PATCH /api/users/:id — update label and/or student_type
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { label, student_type } = req.body || {};
  if (student_type !== undefined && student_type !== null && !VALID_STUDENT_TYPES.includes(student_type)) {
    return res.status(400).json({ error: `student_type must be one of: ${VALID_STUDENT_TYPES.join(', ')}` });
  }
  const db = getDb();
  const user = db.prepare('SELECT id FROM secrets WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (label !== undefined) db.prepare('UPDATE secrets SET label = ? WHERE id = ?').run(label || null, id);
  if (student_type !== undefined) db.prepare('UPDATE secrets SET student_type = ? WHERE id = ?').run(student_type || null, id);
  const updated = db.prepare('SELECT id, username, label, student_type FROM secrets WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/users/:id — remove a user
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const cfg = db.prepare('SELECT active_user_id FROM app_config WHERE id = 1').get();
  if (cfg && cfg.active_user_id === id) return res.status(400).json({ error: 'Cannot delete the active user' });
  const result = db.prepare('DELETE FROM secrets WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ deleted: id });
});

module.exports = router;
