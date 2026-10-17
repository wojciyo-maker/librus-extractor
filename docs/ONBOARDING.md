# Onboarding Guide

Welcome. This guide gets you from a fresh clone to a running dashboard with
real Librus data, then points you at the code paths you'll most likely need
to touch.

## Prerequisites

- **Node.js 22+** — the server uses the built-in `node:sqlite` module, which
  is only stable on Node 22. Run `node --version` before you start.
- **A real Librus account.** There is no fixture data; every page is empty
  until a sync succeeds. Mock data would diverge from the real Librus schema
  and isn't worth maintaining.
- An SMTP account if you want to test the email digest (Gmail App Passwords
  work). Not required to run the app.

## First-time setup

```bash
git clone <repo>
cd librus-extractor

# Server deps
npm install

# Client deps (separate package.json)
cd client && npm install && cd ..

# Optional: configure SMTP / port from the shell instead of the UI
cp .env.example .env
$EDITOR .env
```

The `data/` directory is created on first server start by
[server/db.js](../server/db.js) — you don't need to mkdir it. The SQLite
schema is created and migrated on every boot, so there are no manual
migration steps.

## Running locally

```bash
npm run dev
```

This launches two processes via `concurrently`:

- **Express** on `http://localhost:3001` — serves the API and (in prod) the
  built SPA.
- **Vite** on `http://localhost:5173` — the React dev server with HMR. Its
  config proxies `/api/*` to `:3001`, so always open `:5173` in your
  browser during development.

Stop both with a single `Ctrl-C`.

For a production-like run:

```bash
npm run build  # builds client/dist
npm start      # Express serves the API + dist on PORT (default 3001)
```

## Adding your first user

The app has no built-in seed data. After the dev server is up:

1. Open `http://localhost:5173`.
2. Go to **Settings → Użytkownicy → Dodaj użytkownika**.
3. Provide your Librus `username` and `password`. Optionally set a friendly
   `label` and the `student_type` (this only affects UI labels, not scraping).
4. Click **Synchronizuj** in the sidebar (or wait for the next 08:00 /
   17:00 Europe/Warsaw cron tick). The first sync writes
   `data/librus-result-1.xml`, then parses it into SQLite.

You can also seed credentials directly via `curl`:

```bash
curl -X POST http://localhost:3001/api/users \
  -H 'Content-Type: application/json' \
  -d '{"username":"you@librus","password":"…","label":"You"}'

curl -X POST http://localhost:3001/api/sync
```

## Project tour

Read in this order — each file is short and self-contained.

1. **[server/app.js](../server/app.js)** — Express setup, route mounting,
   cron schedule, and the static-serve fallback for the SPA. Start here to
   see the top-level wiring.
2. **[index.js](../index.js)** — the Librus scraper. Spawned as a child
   process per user during sync. Reads credentials from `secrets` and emits
   one XML file per user. The XML format is what `server/parser.js` consumes.
3. **[server/scraper.js](../server/scraper.js)** — orchestrates the
   per-user spawn loop and feeds results into `parser.js` and `email.js`.
4. **[server/parser.js](../server/parser.js)** — XML → SQLite. This is
   where grade weight parsing, announcement hashing, and change tracking
   live. Most "data looks wrong" bugs trace back here.
5. **[server/db.js](../server/db.js)** — schema, migrations, and the
   `getDb()` / `getActiveUserId()` helpers. New tables go here, plus a
   migration step if you ship to existing installs.
6. **[server/routes/*.js](../server/routes/)** — one file per resource.
   Routes are thin: they call `getActiveUserId()`, run a SQL query, and
   shape the JSON. No service layer.
7. **[client/src/App.jsx](../client/src/App.jsx)** — sidebar, user switcher,
   and the `dataVersion` counter that forces all pages to refetch after a
   sync.
8. **[client/src/pages/](../client/src/pages/)** — one component per page,
   each fetching its own data with the inline `useFetch` hook from
   [Dashboard.jsx](../client/src/pages/Dashboard.jsx).

Other useful docs:

- [docs/API.md](API.md) — REST endpoint reference (shapes + examples).
- [docs/SCHEMA.md](SCHEMA.md) — SQLite table reference.

## Common dev tasks

### Re-sync a single user from the CLI

```bash
# Default: uses active_user_id from app_config
npm run sync

# Specific user
node -e "require('./server/parser').parseAndSync(2).then(console.log)"
```

This skips the network step and just re-parses the existing
`data/librus-result-{id}.xml`. Handy when iterating on parser changes.

### Inspect the database

```bash
sqlite3 data/librus.db
sqlite> .tables
sqlite> SELECT * FROM sync_log ORDER BY id DESC LIMIT 5;
```

### Add a new field to an existing table

1. Add the column in `initSchema` in [server/db.js](../server/db.js).
2. Add a migration block alongside `migrateToMultiUser` that `ALTER TABLE …
   ADD COLUMN` for existing installs (SQLite tolerates `IF NOT EXISTS`-style
   patterns via a try/catch).
3. Populate the column in `server/parser.js`.
4. Expose it in the matching `server/routes/*.js` and consume it in the
   page component.

### Add a new API endpoint

1. Create `server/routes/<resource>.js` exporting an Express router.
2. Mount it in [server/app.js](../server/app.js).
3. Document it in [docs/API.md](API.md).

### Run only the client or only the server

```bash
npm run dev:server   # Express on :3001
npm run dev:client   # Vite on :5173 — needs the server running for /api/*
```

## Gotchas

- **No tests, no CI.** Type checking is informal — `node` will surface
  missing requires at runtime. Manual verification through the UI is the
  current acceptance gate.
- **Librus credentials are stored as plaintext** in `secrets.password`.
  Don't ship `data/librus.db` to anywhere you wouldn't ship the password
  itself. The `.gitignore` excludes the whole `data/` directory; keep it
  that way.
- **Cron timezone is hardcoded** to `Europe/Warsaw` in
  [server/app.js](../server/app.js). If you deploy elsewhere, this still
  works — `node-cron` honours the timezone option regardless of the host
  clock — but the comment in the code may be misleading.
- **Timetable is full-refreshed** every sync, not diffed. That means the
  "first seen" semantics that work for grades and absences don't apply
  here. If you need historical timetable data, you'll have to add it.
- **The fallback `app.get('*')` route serves `client/dist/index.html`.**
  If you `npm run dev` *without* having ever run `npm run build`, hitting
  `:3001` directly will 404 — use the Vite URL (`:5173`) for development.
- **`/api/sync` is synchronous.** Browsers will sit on the request for as
  long as the scrape takes. Don't put it on a tight UI auto-poll.

## Where to ask for help

- Code questions → start by reading the file referenced above; everything
  is under ~250 lines.
- Librus API quirks → the `librus-api` package on npm; field names in the
  XML map 1:1 to that library's response objects.
- Data shape questions → [docs/SCHEMA.md](SCHEMA.md).
- HTTP shape questions → [docs/API.md](API.md).
