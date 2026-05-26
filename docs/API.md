# API Reference

All endpoints are mounted under `/api` by [server/app.js](../server/app.js)
and return JSON. There is currently **no authentication** — the server is
designed for local / trusted-network use only. CORS is enabled for every
origin.

Responses are always scoped to the **active user** (`app_config.active_user_id`)
except for endpoints under `/api/users` and `/api/sync`, which manage all
users.

| Method | Path                          | Purpose                                  |
|--------|-------------------------------|------------------------------------------|
| GET    | `/api/account`                | Active student's profile                 |
| GET    | `/api/users`                  | List all managed users                   |
| POST   | `/api/users`                  | Add a new Librus account                 |
| PATCH  | `/api/users/:id`              | Update label / student type              |
| DELETE | `/api/users/:id`              | Remove a user (not the active one)       |
| POST   | `/api/users/:id/activate`     | Switch which user the UI shows           |
| GET    | `/api/grades`                 | Grades grouped by subject + semester     |
| GET    | `/api/absences`               | Absences grouped by date                 |
| GET    | `/api/announcements`          | Announcements, newest first              |
| GET    | `/api/timetable`              | Weekly timetable                         |
| POST   | `/api/sync`                   | Trigger a sync for all users now         |
| GET    | `/api/sync/log`               | Last 20 sync runs                        |
| GET    | `/api/settings`               | Read notification + SMTP config          |
| PUT    | `/api/settings`               | Update notification + SMTP config        |

---

## Account

### `GET /api/account`

Returns the profile for the active user, or `null` if no sync has populated
the `account` table yet.

```json
{
  "id": 1,
  "student_name": "Jan Kowalski",
  "student_class": "3A",
  "student_index": 12,
  "educator": "Anna Nowak",
  "login": "jan.kowalski@librus",
  "updated_at": "2026-05-26T08:00:42.123Z"
}
```

## Users

### `GET /api/users`

```json
[
  {
    "id": 1,
    "username": "jan.kowalski@librus",
    "label": "Janek",
    "student_type": "primary_upper",
    "student_name": "Jan Kowalski",
    "is_active": true
  }
]
```

`student_name` is joined from `account` and may be `null` until the first
sync completes.

### `POST /api/users`

Adds a new Librus account.

```json
// request
{
  "username": "anna.kowalska@librus",
  "password": "•••••••••",
  "label": "Anka",              // optional — defaults to username
  "student_type": "secondary"   // optional, one of: primary_lower | primary_upper | secondary
}

// response 201
{
  "id": 2,
  "username": "anna.kowalska@librus",
  "label": "Anka",
  "student_type": "secondary",
  "is_active": false
}
```

`username` and `password` are required. `student_type` is validated against
the enum above; invalid values return `400`.

### `PATCH /api/users/:id`

Partial update of `label` and/or `student_type`. The `username` and
`password` are intentionally not editable here — delete and re-create the
user to rotate credentials.

```json
// request
{ "label": "Anna (LO)" }

// response 200
{
  "id": 2,
  "username": "anna.kowalska@librus",
  "label": "Anna (LO)",
  "student_type": "secondary"
}
```

### `DELETE /api/users/:id`

Removes the user and their per-user rows. Returns `409` if you try to delete
the currently active user — switch first via `POST /api/users/:id/activate`.

```json
// response 200
{ "deleted": 2 }
```

### `POST /api/users/:id/activate`

Sets `app_config.active_user_id` to `:id`. All other GET endpoints will now
return that user's data.

```json
// response 200
{ "active_user_id": 2 }
```

## Grades

### `GET /api/grades`

Grades for the active user, grouped by subject and semester, with a weighted
average per semester. Only numeric grades with `counts_for_average = 1`
contribute to the average.

```json
[
  {
    "name": "Matematyka",
    "semesters": [
      {
        "semester": 1,
        "average": 4.5,
        "grades": [
          {
            "id": 12345,
            "value": "5",
            "category": "Kartkówka",
            "date": "2026-01-15",
            "teacher": "Pan Kowalski",
            "weight": 1.5,
            "countsForAverage": true,
            "comment": null,
            "firstSeenAt": "2026-01-15T08:00:42.000Z"
          }
        ]
      }
    ]
  }
]
```

## Absences

### `GET /api/absences`

```json
{
  "total": 5,
  "byDate": [
    {
      "date": "2026-01-20",
      "lessons": [
        {
          "id": 678,
          "lessonNum": 2,
          "type": "nieobecność",
          "firstSeenAt": "2026-01-20T17:00:11.000Z"
        }
      ]
    }
  ]
}
```

`total` counts individual lesson absences, not distinct dates.

## Announcements

### `GET /api/announcements`

Returned newest first.

```json
[
  {
    "id": "VHJlbm5pbmcgcGlsa2FyemUuLi58MjAyNi0wNS0yMA==",
    "title": "Trening piłkarzy",
    "userName": "Anna Nowak",
    "date": "2026-05-20",
    "content": "W poniedziałek...",
    "firstSeenAt": "2026-05-20T17:00:03.000Z"
  }
]
```

The `id` is the stable hash described in [docs/SCHEMA.md](SCHEMA.md#announcements).

## Timetable

### `GET /api/timetable`

```json
{
  "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "lessons": [1, 2, 3, 4, 5, 6, 7, 8],
  "byDay": {
    "Monday": [
      {
        "lessonNum": 1,
        "subject": "Matematyka",
        "teacher": "Pan Kowalski",
        "room": "101",
        "timeSlot": "08:00-08:45"
      }
    ]
  }
}
```

`lessons` is the union of lesson numbers seen across the week (rows with no
data for a particular day are simply absent from that day's array).

## Sync

### `POST /api/sync`

Triggers `scrapeAndParseAll()` synchronously — the response is returned only
after every user has been scraped, parsed, and (optionally) emailed. A full
sync against the live Librus servers typically takes 10–60s per user, so
clients should set a generous timeout.

```json
// response 200
{
  "results": [
    {
      "userId": 1,
      "changes": { "grades": [...], "absences": [], "homework": [], "announcements": [...] },
      "totalChanges": 3,
      "syncedAt": "2026-05-26T12:34:56.000Z"
    }
  ],
  "totalChanges": 3
}
```

If a single user's scrape fails (bad credentials, Librus down, …) the run
continues for the others and the failure is included as an error string on
that user's result.

### `GET /api/sync/log`

Most recent 20 sync runs, newest first.

```json
[
  {
    "id": 87,
    "userId": 1,
    "syncedAt": "2026-05-26T12:34:56.000Z",
    "changes": {
      "grades": [{ "id": 12345, "subject": "Matematyka", "value": "5" }],
      "absences": [],
      "homework": [],
      "announcements": []
    }
  }
]
```

## Settings

### `GET /api/settings`

Returns the current notification + SMTP configuration. The SMTP password is
**never** returned; `hasSmtpPass` reports whether one is stored.

```json
{
  "emailTo": "parent@example.com",
  "notifyGrades": true,
  "notifyAbsences": true,
  "notifyHomework": false,
  "notifyAnnouncements": true,
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "alerts@example.com",
  "smtpFrom": "Librus Dashboard <alerts@example.com>",
  "hasSmtpPass": true
}
```

### `PUT /api/settings`

Partial update — only the fields you send are written. Send `smtpPass: ""`
to clear the stored password; omitting the field leaves it unchanged.

```json
// request
{
  "notifyHomework": true,
  "smtpPass": "new-app-password"
}

// response 200
{ "ok": true }
```

> **Precedence:** env vars `SMTP_*` and `NOTIFY_EMAIL` override these values
> at send time — they exist as fallbacks for deployments that prefer dotenv
> over the UI.
