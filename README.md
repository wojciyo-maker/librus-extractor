# librus-extractor

A self-hosted dashboard that scrapes a student's Librus account, stores the
data locally in SQLite, and presents it through a React UI. Supports multiple
students from a single instance and can send email digests when new grades,
absences, homework, or announcements appear.

## Features

- **Grades** with per-subject / per-semester views and weighted averages
- **Timetable** rendered as a day-by-lesson grid
- **Absences** grouped by date
- **Announcements** with full body content
- **Multi-user support** — store several Librus accounts and switch between them
- **Email notifications** via SMTP whenever a sync turns up new data
- **Scheduled sync** twice a day (08:00 and 17:00 Europe/Warsaw) plus a manual sync button

## Architecture

```
┌────────────────────────────┐        ┌────────────────────────────┐
│  React + Vite (client/)    │        │  Express server (server/)  │
│  - SPA on port 5173 (dev)  │  /api  │  - REST API on port 3001   │
│  - served from dist/ in    │ ─────▶ │  - cron @ 08:00 / 17:00    │
│    prod by Express         │        │  - serves client/dist      │
└────────────────────────────┘        └──────────────┬─────────────┘
                                                     │
                          spawns child process       │
                          per user during sync       ▼
                                            ┌──────────────────┐
                                            │   index.js       │
                                            │  (scraper using  │
                                            │   librus-api)    │
                                            └────────┬─────────┘
                                                     │ writes
                                                     ▼
                                       data/librus-result-{id}.xml
                                                     │
                                     server/parser.js│ reads + upserts
                                                     ▼
                                          data/librus.db (SQLite)
```

Sync flow:

1. `POST /api/sync` (or cron) calls `scrapeAndParseAll()` in [server/scraper.js](server/scraper.js).
2. For each row in the `secrets` table, the server spawns [index.js](index.js)
   as a child process with `--user={id}`. The child logs into Librus via the
   `librus-api` library and writes everything it finds to
   `data/librus-result-{id}.xml`.
3. [server/parser.js](server/parser.js) parses that XML with `xml2js` and
   upserts rows into the per-user tables in `data/librus.db`. Anything new is
   recorded in `sync_log.changes_json`.
4. If notifications are enabled and SMTP is configured,
   [server/email.js](server/email.js) sends a digest of the changes.

## Tech stack

| Layer    | Tech                                                              |
|----------|-------------------------------------------------------------------|
| Backend  | Node.js, Express 4, `node:sqlite` (built-in), `node-cron`, `xml2js`, `nodemailer` |
| Scraper  | `librus-api`                                                      |
| Frontend | React 18, React Router 6, Vite 5 (no state library, plain `fetch`) |
| Storage  | SQLite (WAL mode) in `data/librus.db` + raw XML dumps per user    |

## Quick start

```bash
# 1. Install dependencies (root + client)
npm install
cd client && npm install && cd ..

# 2. (Optional) Copy env template for SMTP / port
cp .env.example .env

# 3. Run server + Vite dev server concurrently
npm run dev
# → server on http://localhost:3001
# → UI    on http://localhost:5173 (proxies /api/* to :3001)

# 4. Add your first Librus account via the UI:
#    Settings → Użytkownicy → Dodaj użytkownika
#    Provide the Librus login + password.

# 5. Click "Synchronizuj" to pull data, or wait for the 08:00 / 17:00 cron.
```

For production:

```bash
npm run build   # builds client/dist
npm start       # Express serves both API and the built SPA on PORT (default 3001)
```

## Repository layout

```
.
├── index.js               # CLI scraper, spawned per user during sync
├── server/
│   ├── app.js             # Express app, routes, cron schedule
│   ├── db.js              # SQLite init, schema, multi-user migrations
│   ├── scraper.js         # Orchestrates index.js subprocesses + parser
│   ├── parser.js          # XML → SQLite upserts, change tracking
│   ├── email.js           # SMTP notifications via nodemailer
│   └── routes/            # One file per resource (grades, users, …)
├── client/
│   ├── src/
│   │   ├── App.jsx        # Layout, sidebar, user switcher, sync button
│   │   ├── main.jsx       # Router entry
│   │   └── pages/         # Dashboard, Grades, Timetable, Absences, …
│   └── vite.config.js     # Dev proxy to :3001
├── data/
│   ├── librus.db          # SQLite database (auto-created)
│   └── librus-result-*.xml# Raw scraper dumps per user
├── docs/
│   ├── SCHEMA.md          # Data model reference
│   ├── API.md             # REST endpoint reference
│   └── ONBOARDING.md      # New-developer setup guide
└── .env.example
```

## Configuration

All env vars are optional and loaded by `dotenv` at server startup
([server/app.js](server/app.js)). SMTP settings can alternatively be
configured through the **Settings** page in the UI; env vars take precedence
over the database values.

| Variable      | Purpose                                       | Default |
|---------------|-----------------------------------------------|---------|
| `PORT`        | Express listen port                           | `3001`  |
| `SMTP_HOST`   | SMTP server hostname                          | —       |
| `SMTP_PORT`   | SMTP server port                              | `587`   |
| `SMTP_USER`   | SMTP auth username                            | —       |
| `SMTP_PASS`   | SMTP auth password (Gmail: use App Password)  | —       |
| `SMTP_FROM`   | `From:` header for outgoing notifications     | —       |
| `NOTIFY_EMAIL`| Recipient address for digests                 | —       |

The cron schedule (`0 8 * * *` and `0 17 * * *`, timezone `Europe/Warsaw`) is
hardcoded in [server/app.js](server/app.js).

## Further reading

- [docs/ONBOARDING.md](docs/ONBOARDING.md) — getting set up as a developer
- [docs/API.md](docs/API.md) — REST endpoint reference
- [docs/SCHEMA.md](docs/SCHEMA.md) — SQLite tables and field semantics
