'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'librus.db');
let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at   TEXT NOT NULL,
      changes_json TEXT
    );

    CREATE TABLE IF NOT EXISTS account (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      student_name   TEXT,
      student_class  TEXT,
      student_index  INTEGER,
      educator       TEXT,
      login          TEXT,
      updated_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS grades (
      id                  INTEGER PRIMARY KEY,
      subject             TEXT NOT NULL,
      semester            INTEGER NOT NULL,
      value               TEXT NOT NULL,
      category            TEXT,
      date                TEXT,
      teacher             TEXT,
      weight              REAL,
      counts_for_average  INTEGER DEFAULT 1,
      comment             TEXT,
      first_seen_at       TEXT NOT NULL,
      synced_at           TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS absences (
      id            INTEGER PRIMARY KEY,
      date          TEXT NOT NULL,
      lesson_num    INTEGER NOT NULL,
      type          TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      synced_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS homework (
      id            INTEGER PRIMARY KEY,
      subject       TEXT,
      title         TEXT,
      description   TEXT,
      teacher       TEXT,
      date_added    TEXT,
      first_seen_at TEXT NOT NULL,
      synced_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      user_name     TEXT,
      date          TEXT,
      content       TEXT,
      first_seen_at TEXT NOT NULL,
      synced_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      lesson_num  INTEGER NOT NULL,
      subject     TEXT,
      teacher     TEXT,
      room        TEXT,
      time_slot   TEXT,
      UNIQUE(day_of_week, lesson_num)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications_config (
      id                   INTEGER PRIMARY KEY DEFAULT 1,
      email_to             TEXT,
      notify_grades        INTEGER DEFAULT 1,
      notify_absences      INTEGER DEFAULT 1,
      notify_homework      INTEGER DEFAULT 1,
      notify_announcements INTEGER DEFAULT 1,
      smtp_host            TEXT,
      smtp_port            INTEGER DEFAULT 587,
      smtp_user            TEXT,
      smtp_pass            TEXT,
      smtp_from            TEXT
    );

    INSERT OR IGNORE INTO notifications_config (id) VALUES (1);
  `);
}

module.exports = { getDb };
