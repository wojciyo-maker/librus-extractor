'use strict';
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { getDb } = require('./db');

// xml2js chokes on tag names starting with digits (invalid XML); prefix them
function preprocessXml(xml) {
  xml = xml.replace(/<(\d[\w-]*)/g, '<n_$1');
  xml = xml.replace(/<\/(\d[\w-]*)/g, '</n_$1');
  return xml;
}

function ensureArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// Parses the multi-line grade info string:
// "Kategoria: kartkówka\nData: 2025-10-09 (czw.)\nNauczyciel: ...\n..."
function parseGradeInfo(info) {
  if (!info || typeof info !== 'string') return {};
  const result = {};
  const commentLines = [];
  let inComment = false;

  for (const raw of info.trim().split('\n')) {
    const line = raw.trim();
    if (inComment) { commentLines.push(line); continue; }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    switch (key) {
      case 'Kategoria':         result.category = value; break;
      case 'Umiejętność':       result.category = value; break;
      case 'Data':              result.date = value.replace(/\s*\([^)]+\)$/, '').trim(); break;
      case 'Nauczyciel':        result.teacher = value; break;
      case 'Licz do średniej':  result.countsForAverage = value === 'tak' ? 1 : 0; break;
      case 'Waga':              result.weight = parseFloat(value) || null; break;
      case 'Komentarz':         inComment = true; if (value) commentLines.push(value); break;
    }
  }
  if (commentLines.length) result.comment = commentLines.join('\n').trim();
  return result;
}

function cleanDate(str) {
  if (!str) return null;
  return String(str).replace(/\s*\([^)]+\)$/, '').trim();
}

async function parseAndSync(userId = 1) {
  const xmlPath = path.join(__dirname, '..', 'data', `librus-result-${userId}.xml`);
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`data/librus-result-${userId}.xml not found. Run sync first.`);
  }

  const xmlRaw = fs.readFileSync(xmlPath, 'utf-8');
  const xmlFixed = preprocessXml(xmlRaw);

  const parsed = await xml2js.parseStringPromise(xmlFixed, {
    explicitArray: true,
    trim: true,
    ignoreAttrs: true,
  });

  const root = parsed.LibrusResults;
  if (!root) throw new Error('Unexpected XML structure: missing LibrusResults root');

  const db = getDb();
  const now = new Date().toISOString();
  const changes = { grades: [], absences: [], homework: [], announcements: [] };

  // ── Account Info ────────────────────────────────────────────────────────────
  if (root.Account_Info) {
    const ai = root.Account_Info[0];
    const student = ai.student?.[0];
    const account = ai.account?.[0];
    if (student) {
      db.prepare(`
        INSERT OR REPLACE INTO account (id, student_name, student_class, student_index, educator, login, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        student.nameSurname?.[0] ?? null,
        student.class?.[0] ?? null,
        student.index?.[0] ?? null,
        student.educator?.[0] ?? null,
        account?.login?.[0] ?? null,
        now
      );
    }
  }

  // ── Subjects ─────────────────────────────────────────────────────────────────
  if (root.Subjects) {
    for (const item of ensureArray(root.Subjects[0]?.item)) {
      const id = parseInt(item.id?.[0]);
      const name = item.name?.[0];
      if (id && name) {
        db.prepare('INSERT OR REPLACE INTO subjects (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, name);
      }
    }
  }

  // ── Grades ───────────────────────────────────────────────────────────────────
  if (root.Grades) {
    const upsertGrade = db.prepare(`
      INSERT INTO grades (id, user_id, subject, semester, value, category, date, teacher, weight, counts_for_average, comment, first_seen_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET
        value = excluded.value, category = excluded.category, date = excluded.date,
        teacher = excluded.teacher, weight = excluded.weight,
        counts_for_average = excluded.counts_for_average, comment = excluded.comment,
        synced_at = excluded.synced_at
    `);

    for (const subject of ensureArray(root.Grades[0]?.item)) {
      const subjectName = subject.name?.[0];
      if (!subjectName) continue;

      ensureArray(subject.semester?.[0]?.item).forEach((sem, semIdx) => {
        for (const gradeItem of ensureArray(sem.grades?.[0]?.item)) {
          const id = parseInt(gradeItem.id?.[0]);
          const value = gradeItem.value?.[0];
          if (!id || value == null) continue;

          const info = parseGradeInfo(gradeItem.info?.[0]);
          const isNew = !db.prepare('SELECT 1 FROM grades WHERE id = ? AND user_id = ?').get(id, userId);

          // Default: numeric grades count; 'np'/'nob'/symbolic ones don't
          const defaultCount = /^\d+(\+|-)?$/.test(value) ? 1 : 0;
          const countsForAverage = info.countsForAverage ?? defaultCount;

          upsertGrade.run(
            id, userId, subjectName, semIdx + 1, value,
            info.category ?? null, info.date ?? null, info.teacher ?? null,
            info.weight ?? null, countsForAverage,
            info.comment ?? null,
            now, now
          );
          if (isNew) changes.grades.push({ id, subject: subjectName, semester: semIdx + 1, value, date: info.date });
        }
      });
    }
  }

  // ── Absences ──────────────────────────────────────────────────────────────────
  if (root.Absences) {
    const upsertAbsence = db.prepare(`
      INSERT INTO absences (id, user_id, date, lesson_num, type, first_seen_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET type = excluded.type, synced_at = excluded.synced_at
    `);

    const absRoot = root.Absences[0];
    for (const key of Object.keys(absRoot)) {
      for (const page of ensureArray(absRoot[key])) {
        for (const dayItem of ensureArray(page.item)) {
          const date = cleanDate(dayItem.date?.[0]);
          ensureArray(dayItem.table?.[0]?.item).forEach((cell, lessonIdx) => {
            if (!cell || typeof cell !== 'object') return;
            const type = cell.type?.[0];
            const id = parseInt(cell.id?.[0]);
            if (!id || !type) return;
            const isNew = !db.prepare('SELECT 1 FROM absences WHERE id = ? AND user_id = ?').get(id, userId);
            upsertAbsence.run(id, userId, date, lessonIdx + 1, type, now, now);
            if (isNew) changes.absences.push({ id, date, lessonNum: lessonIdx + 1, type });
          });
        }
      }
    }
  }

  // ── Homework ──────────────────────────────────────────────────────────────────
  if (root.Homeworks) {
    const upsertHw = db.prepare(`
      INSERT INTO homework (id, user_id, subject, title, description, teacher, date_added, first_seen_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET synced_at = excluded.synced_at
    `);
    for (const item of ensureArray(root.Homeworks[0]?.item)) {
      const id = parseInt(item.id?.[0]);
      if (!id) continue;
      const isNew = !db.prepare('SELECT 1 FROM homework WHERE id = ? AND user_id = ?').get(id, userId);
      upsertHw.run(
        id, userId,
        item.subject?.[0] ?? null, item.title?.[0] ?? null,
        item.description?.[0] ?? null, item.teacher?.[0] ?? null,
        item.date?.[0] ?? null, now, now
      );
      if (isNew) changes.homework.push({ id, subject: item.subject?.[0], title: item.title?.[0] });
    }
  }

  // ── Announcements ─────────────────────────────────────────────────────────────
  if (root.Announcements) {
    const upsertAnn = db.prepare(`
      INSERT INTO announcements (id, user_id, title, user_name, date, content, first_seen_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET synced_at = excluded.synced_at
    `);
    for (const item of ensureArray(root.Announcements[0]?.item)) {
      const title = item.title?.[0] ?? '';
      const date  = item.date?.[0] ?? '';
      // Stable ID: base64 of title+date, capped to 40 chars
      const id = Buffer.from(title + '|' + date).toString('base64').substring(0, 40);
      const isNew = !db.prepare('SELECT 1 FROM announcements WHERE id = ? AND user_id = ?').get(id, userId);
      upsertAnn.run(id, userId, title, item.user?.[0] ?? null, date, item.content?.[0] ?? null, now, now);
      if (isNew) changes.announcements.push({ id, title, date });
    }
  }

  // ── Timetable (full refresh per user each sync) ───────────────────────────────
  if (root.Timetable) {
    db.prepare('DELETE FROM timetable WHERE user_id = ?').run(userId);
    const table = root.Timetable[0]?.table?.[0];
    if (table) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO timetable (user_id, day_of_week, lesson_num, subject, teacher, room, time_slot)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
        ensureArray(table[day]?.[0]?.item).forEach((item, idx) => {
          if (!item || typeof item !== 'object') return;
          const subject = item.subject?.[0];
          if (!subject) return;
          insert.run(userId, day, idx + 1, subject, item.teacher?.[0] ?? null, item.room?.[0] ?? null, item.time?.[0] ?? null);
        });
      }
    }
  }

  // ── Sync log ──────────────────────────────────────────────────────────────────
  const totalChanges = Object.values(changes).reduce((s, a) => s + a.length, 0);
  db.prepare('INSERT INTO sync_log (user_id, synced_at, changes_json) VALUES (?, ?, ?)').run(userId, now, JSON.stringify(changes));

  return { changes, totalChanges, syncedAt: now };
}

module.exports = { parseAndSync };
