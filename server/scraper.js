'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { parseAndSync } = require('./parser');
const { sendNotification } = require('./email');
const { getDb } = require('./db');

const SCRAPER_PATH = path.join(__dirname, '..', 'index.js');

// Run index.js for a specific user, writing its XML to data/librus-result-{userId}.xml
function runScraper(userId) {
  return new Promise((resolve, reject) => {
    console.log(`[scraper] Fetching Librus data for user ${userId}…`);
    const child = spawn(process.execPath, [SCRAPER_PATH, `--user=${userId}`], { stdio: 'inherit' });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`index.js exited with code ${code} for user ${userId}`));
    });
    child.on('error', reject);
  });
}

// Scrape + parse all users sequentially. Returns { results, totalChanges }.
async function scrapeAndParseAll() {
  const db = getDb();
  const users = db.prepare('SELECT id FROM secrets ORDER BY id').all();
  let totalChanges = 0;
  const results = [];

  for (const user of users) {
    try {
      await runScraper(user.id);
      const result = await parseAndSync(user.id);
      if (result.totalChanges > 0) {
        await sendNotification(result.changes, result.syncedAt)
          .catch(e => console.error(`[scraper] Email error for user ${user.id}:`, e.message));
      }
      totalChanges += result.totalChanges;
      results.push({ userId: user.id, totalChanges: result.totalChanges, syncedAt: result.syncedAt });
      console.log(`[scraper] User ${user.id} done — ${result.totalChanges} change(s)`);
    } catch (err) {
      console.error(`[scraper] User ${user.id} error:`, err.message);
      results.push({ userId: user.id, error: err.message });
    }
  }

  return { results, totalChanges };
}

module.exports = { scrapeAndParseAll };
