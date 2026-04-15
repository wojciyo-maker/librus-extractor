'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const row = getDb().prepare('SELECT * FROM account WHERE id = 1').get();
  res.json(row || null);
});

module.exports = router;
