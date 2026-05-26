# Data Schema

All persistent data lives in a single SQLite file at `data/librus.db`
(WAL-mode). The schema is created and migrated on every server start by
[server/db.js](../server/db.js) — there are no external migration tools.

Per-student tables use a **composite primary key** of `(id, user_id)` where
`user_id` joins to `secrets.id`. Single-instance tables (`account`,
`app_config`, `notifications_config`) hold one global row.

> **Date conventions:** unless otherwise noted, `*_at` columns hold ISO 8601
> timestamps (UTC) and `date` columns hold `YYYY-MM-DD` strings as returned
> from the Librus scraper.

## Multi-user data tables

### `grades`

Numeric and symbolic grades from all subjects, per semester.

| Column                | Type    | Notes                                                   |
|-----------------------|---------|---------------------------------------------------------|
| `id`                  | INTEGER | Librus grade ID                                         |
| `user_id`             | INTEGER | FK → `secrets.id`, default `1`                          |
| `subject`             | TEXT    | Subject name (e.g. "Matematyka")                        |
| `semester`            | INTEGER | `1` or `2`                                              |
| `value`               | TEXT    | Stored as text — can be `"5"`, `"4+"`, `"np"`, `"nob"`, … |
| `category`            | TEXT    | e.g. "Kartkówka", "Odpowiedź ustna"                     |
| `date`                | TEXT    | Date the grade was given                                |
| `teacher`             | TEXT    | Teacher who issued the grade                            |
| `weight`              | REAL    | Multiplier used when computing weighted average         |
| `counts_for_average`  | INTEGER | `1` for numeric grades, `0` for symbolic ones (`np`, `nob`, …) |
| `comment`             | TEXT    | Optional teacher comment                                |
| `first_seen_at`       | TEXT    | First sync that found this grade — used in the UI badges |
| `synced_at`           | TEXT    | Updated on every sync that re-sees the grade            |
| **PK**                |         | `(id, user_id)`                                         |

**Average formula** (per subject + semester) used in [server/routes/grades.js](../server/routes/grades.js):
`Σ(value × weight) ÷ Σ(weight)` across rows where `counts_for_average = 1`
and `value` parses as a number (the `+` / `-` suffixes are normalised to
`±0.25`).

### `absences`

| Column          | Type    | Notes                                              |
|-----------------|---------|----------------------------------------------------|
| `id`            | INTEGER | Librus absence ID                                  |
| `user_id`       | INTEGER | FK → `secrets.id`                                  |
| `date`          | TEXT    | `YYYY-MM-DD`                                       |
| `lesson_num`    | INTEGER | Lesson slot the absence applies to (1-based)       |
| `type`          | TEXT    | "nieobecność", "spóźnienie", "zwolnienie", …       |
| `first_seen_at` | TEXT    |                                                    |
| `synced_at`     | TEXT    |                                                    |
| **PK**          |         | `(id, user_id)`                                    |

### `homework`

| Column          | Type    | Notes                                  |
|-----------------|---------|----------------------------------------|
| `id`            | INTEGER | Librus homework ID                     |
| `user_id`       | INTEGER | FK → `secrets.id`                      |
| `subject`       | TEXT    |                                        |
| `title`         | TEXT    | Short summary                          |
| `description`   | TEXT    | Full task body                         |
| `teacher`       | TEXT    |                                        |
| `date_added`    | TEXT    | When the assignment was published      |
| `first_seen_at` | TEXT    |                                        |
| `synced_at`     | TEXT    |                                        |
| **PK**          |         | `(id, user_id)`                        |

### `announcements`

`id` is a **stable hash** rather than a Librus-side ID (the public Librus
announcement list does not expose stable IDs). The parser generates it as
`base64(title + "|" + date)`, truncated to 40 chars
([server/parser.js:197-213](../server/parser.js)).

| Column          | Type    | Notes                                              |
|-----------------|---------|----------------------------------------------------|
| `id`            | TEXT    | Hash; up to 40 chars                               |
| `user_id`       | INTEGER | FK → `secrets.id`                                  |
| `title`         | TEXT    |                                                    |
| `user_name`     | TEXT    | Author shown in Librus (e.g. homeroom teacher)     |
| `date`          | TEXT    |                                                    |
| `content`       | TEXT    | Full body                                          |
| `first_seen_at` | TEXT    |                                                    |
| `synced_at`     | TEXT    |                                                    |
| **PK**          |         | `(id, user_id)`                                    |

### `timetable`

The timetable is **fully replaced** for the affected user on every sync —
there is no diff tracking. The `UNIQUE` constraint guarantees one row per
(user, day, lesson) slot.

| Column         | Type    | Notes                                               |
|----------------|---------|-----------------------------------------------------|
| `id`           | INTEGER | Auto-increment, internal                            |
| `user_id`      | INTEGER | FK → `secrets.id`                                   |
| `day_of_week`  | TEXT    | English day name (`Monday`…`Friday`)                |
| `lesson_num`   | INTEGER | 1-based lesson slot                                 |
| `subject`      | TEXT    |                                                     |
| `teacher`      | TEXT    |                                                     |
| `room`         | TEXT    | Classroom number / label                            |
| `time_slot`    | TEXT    | e.g. `"08:00-08:45"`                                |
| **UNIQUE**     |         | `(user_id, day_of_week, lesson_num)`                |

### `subjects`

| Column     | Type    | Notes                            |
|------------|---------|----------------------------------|
| `id`       | INTEGER | Librus subject ID                |
| `user_id`  | INTEGER | FK → `secrets.id`                |
| `name`     | TEXT    | Subject name                     |
| **PK**     |         | `(id, user_id)`                  |

## Single-instance tables

### `account`

Profile information for the **currently active user** (single row, refreshed
every sync). Kept separate from `secrets` because the scraper only learns the
display name / class once it logs in.

| Column           | Type    | Notes                                      |
|------------------|---------|--------------------------------------------|
| `id`             | INTEGER | PK                                         |
| `student_name`   | TEXT    |                                            |
| `student_class`  | TEXT    | e.g. `"3A"`                                |
| `student_index`  | INTEGER |                                            |
| `educator`       | TEXT    | Homeroom teacher                           |
| `login`          | TEXT    | Librus login username                      |
| `updated_at`     | TEXT    | ISO 8601                                   |

### `secrets`

Librus credentials, one row per managed student. The `id` doubles as the
`user_id` foreign key used throughout the schema.

| Column         | Type    | Notes                                                       |
|----------------|---------|-------------------------------------------------------------|
| `id`           | INTEGER | PK — also the `user_id` foreign key used elsewhere          |
| `username`     | TEXT    | Librus login                                                |
| `password`     | TEXT    | **Stored plaintext.** Do not expose this DB publicly        |
| `label`        | TEXT    | UI display name for the user switcher                       |
| `student_type` | TEXT    | One of `primary_lower`, `primary_upper`, `secondary`        |

### `app_config`

Singleton row (`id = 1`).

| Column            | Type    | Notes                              |
|-------------------|---------|------------------------------------|
| `id`              | INTEGER | Always `1`                         |
| `active_user_id`  | INTEGER | Which user the UI currently shows  |

### `notifications_config`

Singleton row (`id = 1`). UI-editable mirror of the SMTP env vars. Env vars
take precedence when both are set ([server/email.js](../server/email.js)).

| Column                  | Type    | Notes                          |
|-------------------------|---------|--------------------------------|
| `id`                    | INTEGER | Always `1`                     |
| `email_to`              | TEXT    | Recipient                      |
| `notify_grades`         | INTEGER | `0` / `1`                      |
| `notify_absences`       | INTEGER | `0` / `1`                      |
| `notify_homework`       | INTEGER | `0` / `1`                      |
| `notify_announcements`  | INTEGER | `0` / `1`                      |
| `smtp_host`             | TEXT    |                                |
| `smtp_port`             | INTEGER | default `587`                  |
| `smtp_user`             | TEXT    |                                |
| `smtp_pass`             | TEXT    | Plaintext, never returned by the API |
| `smtp_from`             | TEXT    | `From:` header                 |

### `sync_log`

Append-only log of every sync run. `changes_json` is the payload used by the
email digest and by the Dashboard "Last sync" card.

| Column         | Type    | Notes                                                                                  |
|----------------|---------|----------------------------------------------------------------------------------------|
| `id`           | INTEGER | Auto-increment                                                                         |
| `user_id`      | INTEGER | Which user this sync run targeted                                                      |
| `synced_at`    | TEXT    | ISO 8601                                                                               |
| `changes_json` | TEXT    | JSON: `{ grades: [...], absences: [...], homework: [...], announcements: [...] }` (each array holds rows newly inserted by this sync) |

## Multi-user isolation

- Every per-student table carries `user_id`, defaulted to `1` for backward
  compatibility with the pre-multi-user schema.
- `server/db.js` runs `migrateToMultiUser` on startup; it adds the column to
  legacy tables and rebuilds primary keys.
- Read paths in `server/routes/*.js` call `getActiveUserId()` before each
  query, so switching the active user instantly re-scopes the UI.
- The XML dump file for user N is `data/librus-result-N.xml`. Old single-user
  installs may still have `data/librus-result.xml`; the parser ignores it
  once per-user files exist.
