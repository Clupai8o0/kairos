# Kairos Agent API Reference

This document is written for LLM agents. It describes every endpoint you can call, what you send, and what you get back. Read it before making any requests.

---

## Authentication

All requests must include an API key in the Authorization header:

```
Authorization: Bearer kairos_sk_<your_key>
```

Keys are created in Settings → Developer within the Kairos app. A key authenticates as the user who created it. There is no separate identity for agent requests.

Keys are scoped. The scopes your key has determine which endpoints you can call. If you get a 401, your key is missing the required scope.

Scope list:
- `tasks:read` — list and get tasks
- `tasks:write` — create, update, delete tasks
- `schedule:run` — trigger the auto-scheduler
- `gcal:sync` — push scheduled tasks to Google Calendar
- `tags:read` — list tags
- `tags:write` — create tags
- `collections:read` — list and get collections
- `collections:write` — create, update, delete collections
- `*` — all access

---

## Base URL

```
https://<your-kairos-domain>
```

All paths below are relative to this base.

---

## Tasks

### List tasks
`GET /api/tasks`

Required scope: `tasks:read`

Query parameters (all optional):
- `status` — filter by status: `pending`, `scheduled`, `in_progress`, `done`, `cancelled`, `backlog`, `blocked`
- `priority` — filter by priority: `1` (urgent), `2` (high), `3` (medium), `4` (low)
- `tagId` — filter by tag ID

Response: array of task objects.

Example:
```
GET /api/tasks?status=pending&priority=1
Authorization: Bearer kairos_sk_...
```

---

### Get a task
`GET /api/tasks/:id`

Required scope: `tasks:read`

Response: single task object or 404.

---

### Create a task
`POST /api/tasks`

Required scope: `tasks:write`

Body (JSON):
```json
{
  "title": "string (required, max 500 chars)",
  "description": "string (optional)",
  "durationMins": 60,
  "deadline": "2025-12-31T17:00:00+11:00",
  "priority": 2,
  "schedulable": true,
  "timeLocked": false,
  "scheduledAt": "2025-12-20T09:00:00+11:00",
  "scheduledEnd": "2025-12-20T10:00:00+11:00",
  "bufferMins": 15,
  "minChunkMins": 30,
  "isSplittable": false,
  "dependsOn": ["task_id_1", "task_id_2"],
  "tagIds": ["tag_id_1"]
}
```

Fields:
- `title` — required. What the task is called.
- `description` — optional extra context.
- `durationMins` — how long the task takes. Required for scheduling.
- `deadline` — ISO 8601 datetime with timezone offset. The scheduler will place the task before this.
- `priority` — 1 urgent, 2 high, 3 medium (default), 4 low.
- `schedulable` — if true (default), the scheduler will auto-place this task. Set false for reference tasks.
- `timeLocked` — if true AND `scheduledAt` is provided, the task is pinned to that exact time. The scheduler will not move it.
- `scheduledAt` / `scheduledEnd` — explicit placement. Only effective when `timeLocked: true`.
- `bufferMins` — gap to add after this task. Default 15.
- `minChunkMins` — minimum chunk size if `isSplittable` is true.
- `isSplittable` — if true, a long task can be broken across multiple slots.
- `dependsOn` — task IDs this task cannot be scheduled before.
- `tagIds` — array of existing tag IDs to attach.

Returns 201 with the created task object. If `schedulable` is true, placement is kicked off automatically in the background.

---

### Update a task
`PATCH /api/tasks/:id`

Required scope: `tasks:write`

Body: same shape as create, all fields optional. Only include what you want to change.

Common status update:
```json
{ "status": "done" }
```

Marking a task done with a GCal event will remove the calendar event automatically.

Returns 200 with the updated task object.

---

### Delete a task
`DELETE /api/tasks/:id`

Required scope: `tasks:write`

Query parameters:
- `scope` — `instance` (default) or `series`. Use `series` to delete all recurrences of a recurring task.

Returns 204 on success.

---

## Task object shape

```json
{
  "id": "string",
  "userId": "string",
  "title": "string",
  "description": "string | null",
  "durationMins": "number | null",
  "deadline": "ISO datetime | null",
  "priority": 1,
  "status": "pending | scheduled | in_progress | done | cancelled | backlog | blocked",
  "schedulable": true,
  "timeLocked": false,
  "gcalEventId": "string | null",
  "scheduledAt": "ISO datetime | null",
  "scheduledEnd": "ISO datetime | null",
  "bufferMins": 15,
  "minChunkMins": "number | null",
  "isSplittable": false,
  "dependsOn": ["task_id"],
  "recurrenceRule": "object | null",
  "parentTaskId": "string | null",
  "recurrenceIndex": "number | null",
  "source": "string | null",
  "completedAt": "ISO datetime | null",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "tags": [{ "id": "string", "name": "string", "color": "string | null" }]
}
```

---

## Scheduling

### Trigger auto-scheduler
`POST /api/schedule/run`

Required scope: `schedule:run`

No body required.

Runs the scheduling pipeline for all pending tasks. Places them into the next available slots based on priority, deadline, duration, and schedule windows. GCal writes do NOT happen here — run `/api/gcal/sync` after scheduling to push to Google Calendar.

If there are many tasks, the run may be chunked. Remaining tasks are enqueued for the next drain cycle.

Response:
```json
{
  "scheduled": 5,
  "remaining": 0
}
```

---

### Sync with Google Calendar
`POST /api/gcal/sync`

Required scope: `gcal:sync`

No body required. Streams NDJSON progress events (content-type: text/plain).

Two phases:
1. Pull — fetches live free/busy data from Google Calendar into the local cache (the scheduler reads this).
2. Push — upserts Google Calendar events for all scheduled tasks.

Each line of the response stream is a JSON object:
```json
{ "phase": "pull" | "push", "type": "progress" | "done" | "error", "message": "string" }
```

Call this after running the scheduler to make sure scheduled tasks appear in Google Calendar.

---

## Tags

### List tags
`GET /api/tags`

Required scope: `tags:read`

Response: array of tag objects.

```json
[{ "id": "string", "name": "string", "color": "string | null", "createdAt": "ISO datetime" }]
```

---

### Create a tag
`POST /api/tags`

Required scope: `tags:write`

Body:
```json
{ "name": "string (required, max 100)", "color": "#hex (optional)" }
```

Returns 201 with the created tag.

---

## Collections

Collections are coordination groups — a way to bundle tasks around a shared goal or deadline.

### List collections
`GET /api/collections`

Required scope: `collections:read`

Response: array of collection objects.

---

### Create a collection
`POST /api/collections`

Required scope: `collections:write`

Body:
```json
{
  "title": "string (required, max 200)",
  "description": "string (optional)",
  "deadline": "ISO datetime (optional)",
  "color": "#hex (optional)"
}
```

Returns 201 with the created collection.

---

## Common patterns for agents

### Create a task and auto-schedule it
```
POST /api/tasks
{ "title": "Review pull request", "durationMins": 30, "priority": 2, "deadline": "<tomorrow ISO>" }
```
The scheduler kicks off automatically. No extra call needed.

### Create an urgent locked task at a specific time
```
POST /api/tasks
{ "title": "Call with client", "durationMins": 60, "scheduledAt": "<ISO>", "scheduledEnd": "<ISO>", "timeLocked": true, "priority": 1 }
```
This pins the task to exactly that time and triggers a full reschedule of other tasks around it.

### Mark a task done
```
PATCH /api/tasks/:id
{ "status": "done" }
```

### Run full scheduling + push to calendar
```
POST /api/schedule/run
POST /api/gcal/sync
```
Run these in sequence. Check the sync stream for errors.

### List all pending high-priority tasks
```
GET /api/tasks?status=pending&priority=1
GET /api/tasks?status=pending&priority=2
```

---

## Error responses

All errors follow this shape:
```json
{ "error": "string or validation error object" }
```

HTTP status codes:
- 400 — bad request (validation error). The `error` field will be a Zod flatten object with `fieldErrors`.
- 401 — missing or invalid API key, or expired key.
- 404 — resource not found or does not belong to your user.
- 500 — server error.

---

## Datetime format

All datetime values are ISO 8601 with timezone offset. Example: `2025-12-20T09:00:00+11:00`. UTC is also valid: `2025-12-20T09:00:00Z`.

---

## Priority scale

| Value | Meaning |
|-------|---------|
| 1 | Urgent — schedule as soon as possible |
| 2 | High |
| 3 | Medium (default) |
| 4 | Low — schedule whenever there is free time |
