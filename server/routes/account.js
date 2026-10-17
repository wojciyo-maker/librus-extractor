'use strict';
const express = require('express');
const { getDb, getActiveUserId } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const row = getDb().prepare('SELECT * FROM account WHERE id = ?').get(getActiveUserId());
  res.json(row || null);
});

module.exports = router;
