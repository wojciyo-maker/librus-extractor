'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const row = getDb().prepare('SELECT * FROM notifications_config WHERE id = 1').get() || {};
  // Don't expose smtp_pass
  res.json({
    emailTo:             row.email_to             ?? null,
    notifyGrades:        row.notify_grades        !== 0,
    notifyAbsences:      row.notify_absences      !== 0,
    notifyHomework:      row.notify_homework      !== 0,
    notifyAnnouncements: row.notify_announcements !== 0,
    smtpHost:            row.smtp_host            ?? null,
    smtpPort:            row.smtp_port            ?? 587,
    smtpUser:            row.smtp_user            ?? null,
    smtpFrom:            row.smtp_from            ?? null,
    hasSmtpPass:         !!row.smtp_pass,
  });
});

router.put('/', (req, res) => {
  const db = getDb();
  const b = req.body;
  const update = db.prepare(`
    UPDATE notifications_config SET
      email_to             = COALESCE(?, email_to),
      notify_grades        = COALESCE(?, notify_grades),
      notify_absences      = COALESCE(?, notify_absences),
      notify_homework      = COALESCE(?, notify_homework),
      notify_announcements = COALESCE(?, notify_announcements),
      smtp_host            = COALESCE(?, smtp_host),
      smtp_port            = COALESCE(?, smtp_port),
      smtp_user            = COALESCE(?, smtp_user),
      smtp_pass            = COALESCE(?, smtp_pass),
      smtp_from            = COALESCE(?, smtp_from)
    WHERE id = 1
  `);
  update.run(
    b.emailTo             ?? null,
    b.notifyGrades        != null ? (b.notifyGrades        ? 1 : 0) : null,
    b.notifyAbsences      != null ? (b.notifyAbsences      ? 1 : 0) : null,
    b.notifyHomework      != null ? (b.notifyHomework      ? 1 : 0) : null,
    b.notifyAnnouncements != null ? (b.notifyAnnouncements ? 1 : 0) : null,
    b.smtpHost ?? null,
    b.smtpPort ?? null,
    b.smtpUser ?? null,
    b.smtpPass ?? null,
    b.smtpFrom ?? null
  );
  res.json({ ok: true });
});

module.exports = router;
