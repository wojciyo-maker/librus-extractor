'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'librus.db');
let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    fixBadAppConfig(db);
    initSchema(db);
    migrateSecrets(db);
    migrateToMultiUser(db);
  }
  return db;
}

function getActiveUserId() {
  const cfg = getDb().prepare('SELECT active_user_id FROM app_config WHERE id = 1').get();
  return (cfg && cfg.active_user_id) ? cfg.active_user_id : 1;
}

// Repair app_config if a previous failed migration left it referencing secrets_old
function fixBadAppConfig(db) {
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='app_config'").get();
    if (row && row.sql && row.sql.includes('secrets_old')) {
      const existing = db.prepare('SELECT * FROM app_config WHERE id = 1').get();
      db.exec('DROP TABLE app_config');
      db.exec('CREATE TABLE app_config (id INTEGER PRIMARY KEY DEFAULT 1, active_user_id INTEGER)');
      const uid = existing ? existing.active_user_id : null;
      db.prepare('INSERT INTO app_config (id, active_user_id) VALUES (1, ?)').run(uid);
    }
  } catch (_) { /* table doesn't exist yet — initSchema will create it */ }
}

function migrateSecrets(db) {
  // Add label column to existing secrets tables that pre-date multi-user support
  const cols = db.prepare('PRAGMA table_info(secrets)').all();
  const hasLabel = cols.some(c => c.name === 'label');
  if (!hasLabel) {
    db.exec('ALTER TABLE secrets ADD COLUMN label TEXT');
  }
}

// Migrate all data tables to include user_id for per-user data isolation.
// Tables with Librus-assigned IDs (grades, absences, homework, announcements)
// need a composite PRIMARY KEY (id, user_id); timetable needs a new UNIQUE constraint.
function migrateToMultiUser(db) {
  const gradesCols = db.prepare('PRAGMA table_info(grades)').all();
  if (gradesCols.some(c => c.name === 'user_id')) return; // already done

  // grades
  db.exec('ALTER TABLE grades RENAME TO grades_old');
  db.exec(`CREATE TABLE grades (
    id                  INTEGER NOT NULL,
    user_id             INTEGER NOT NULL DEFAULT 1,
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
    synced_at           TEXT NOT NULL,
    PRIMARY KEY (id, user_id)
  )`);
  db.exec('INSERT INTO grades SELECT id,1,subject,semester,value,category,date,teacher,weight,counts_for_average,comment,first_seen_at,synced_at FROM grades_old');
  db.exec('DROP TABLE grades_old');

  // absences
  db.exec('ALTER TABLE absences RENAME TO absences_old');
  db.exec(`CREATE TABLE absences (
    id            INTEGER NOT NULL,
    user_id       INTEGER NOT NULL DEFAULT 1,
    date          TEXT NOT NULL,
    lesson_num    INTEGER NOT NULL,
    type          TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    synced_at     TEXT NOT NULL,
    PRIMARY KEY (id, user_id)
  )`);
  db.exec('INSERT INTO absences SELECT id,1,date,lesson_num,type,first_seen_at,synced_at FROM absences_old');
  db.exec('DROP TABLE absences_old');

  // homework
  db.exec('ALTER TABLE homework RENAME TO homework_old');
  db.exec(`CREATE TABLE homework (
    id            INTEGER NOT NULL,
    user_id       INTEGER NOT NULL DEFAULT 1,
    subject       TEXT,
    title         TEXT,
    description   TEXT,
    teacher       TEXT,
    date_added    TEXT,
    first_seen_at TEXT NOT NULL,
    synced_at     TEXT NOT NULL,
    PRIMARY KEY (id, user_id)
  )`);
  db.exec('INSERT INTO homework SELECT id,1,subject,title,description,teacher,date_added,first_seen_at,synced_at FROM homework_old');
  db.exec('DROP TABLE homework_old');

  // announcements
  db.exec('ALTER TABLE announcements RENAME TO announcements_old');
  db.exec(`CREATE TABLE announcements (
    id            TEXT NOT NULL,
    user_id       INTEGER NOT NULL DEFAULT 1,
    title         TEXT NOT NULL,
    user_name     TEXT,
    date          TEXT,
    content       TEXT,
    first_seen_at TEXT NOT NULL,
    synced_at     TEXT NOT NULL,
    PRIMARY KEY (id, user_id)
  )`);
  db.exec('INSERT INTO announcements SELECT id,1,title,user_name,date,content,first_seen_at,synced_at FROM announcements_old');
  db.exec('DROP TABLE announcements_old');

  // timetable — rebuild with user_id in UNIQUE constraint
  db.exec('ALTER TABLE timetable RENAME TO timetable_old');
  db.exec(`CREATE TABLE timetable (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 1,
    day_of_week TEXT NOT NULL,
    lesson_num  INTEGER NOT NULL,
    subject     TEXT,
    teacher     TEXT,
    room        TEXT,
    time_slot   TEXT,
    UNIQUE(user_id, day_of_week, lesson_num)
  )`);
  db.exec('INSERT INTO timetable (user_id,day_of_week,lesson_num,subject,teacher,room,time_slot) SELECT 1,day_of_week,lesson_num,subject,teacher,room,time_slot FROM timetable_old');
  db.exec('DROP TABLE timetable_old');

  // subjects and sync_log — simple ALTER TABLE
  db.exec('ALTER TABLE subjects ADD COLUMN user_id INTEGER DEFAULT 1');
  db.exec('ALTER TABLE sync_log ADD COLUMN user_id INTEGER DEFAULT 1');
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER DEFAULT 1,
      synced_at    TEXT NOT NULL,
      changes_json TEXT
    );

    CREATE TABLE IF NOT EXISTS account (
      id             INTEGER PRIMARY KEY,
      student_name   TEXT,
      student_class  TEXT,
      student_index  INTEGER,
      educator       TEXT,
      login          TEXT,
      updated_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS grades (
      id                  INTEGER NOT NULL,
      user_id             INTEGER NOT NULL DEFAULT 1,
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
      synced_at           TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS absences (
      id            INTEGER NOT NULL,
      user_id       INTEGER NOT NULL DEFAULT 1,
      date          TEXT NOT NULL,
      lesson_num    INTEGER NOT NULL,
      type          TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      synced_at     TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS homework (
      id            INTEGER NOT NULL,
      user_id       INTEGER NOT NULL DEFAULT 1,
      subject       TEXT,
      title         TEXT,
      description   TEXT,
      teacher       TEXT,
      date_added    TEXT,
      first_seen_at TEXT NOT NULL,
      synced_at     TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id            TEXT NOT NULL,
      user_id       INTEGER NOT NULL DEFAULT 1,
      title         TEXT NOT NULL,
      user_name     TEXT,
      date          TEXT,
      content       TEXT,
      first_seen_at TEXT NOT NULL,
      synced_at     TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL DEFAULT 1,
      day_of_week TEXT NOT NULL,
      lesson_num  INTEGER NOT NULL,
      subject     TEXT,
      teacher     TEXT,
      room        TEXT,
      time_slot   TEXT,
      UNIQUE(user_id, day_of_week, lesson_num)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id      INTEGER NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      name    TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
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

    CREATE TABLE IF NOT EXISTS secrets (
      id       INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      label    TEXT
    );

    CREATE TABLE IF NOT EXISTS app_config (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      active_user_id INTEGER
    );

    INSERT OR IGNORE INTO app_config (id) VALUES (1);
  `);
}

module.exports = { getDb, getActiveUserId };
