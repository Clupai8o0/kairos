# GCal Integration — Kairos

Reference doc for `lib/gcal/`. Read before touching any GCal file.

---

## Module map (ADR-R2)

```
lib/gcal/
├── errors.ts      # GoogleApiError → domain error mapping
├── auth.ts        # OAuth2 client from DB tokens + token auto-refresh
├── freebusy.ts    # Free/busy queries via calendar.freebusy.query()
├── events.ts      # Event upsert (insert or update) + delete
├── calendars.ts   # Sync calendar list from GCal API → googleCalendars table
└── adapter.ts     # GCalAdapter implementation injected into runner.ts
```

No file over ~250 lines. Route handlers and services never import from `googleapis` directly.

---

## Auth flow

1. User signs in via Better Auth Google OAuth (grants `https://www.googleapis.com/auth/calendar`)
2. Better Auth stores `account.access_token` and `account.refresh_token` in the `account` table
3. `lib/gcal/auth.ts` reads these from DB, constructs `google.auth.OAuth2`, sets credentials
4. Auto-refresh: the oauth2Client `'tokens'` event fires when a new access token is issued; the handler writes it back to DB

**Token source:** Better Auth stores tokens in the `account` table (from `lib/db/schema/auth.ts`), not in `googleAccounts`. `googleAccounts` stores the GCal-specific metadata. `auth.ts` reads from the Better Auth `account` table.

---

## Free/busy

`calendar.freebusy.query()` accepts:
- `timeMin` / `timeMax`: ISO strings
- `items`: array of `{ id: calendarId }`

Returns `{ calendars: { [calendarId]: { busy: [{ start, end }] } } }`.

---

## Events

- Insert: `calendar.events.insert({ calendarId, requestBody: event })`
- Update: `calendar.events.update({ calendarId, eventId, requestBody: event })`
- Delete: `calendar.events.delete({ calendarId, eventId })`

Event body for a scheduled task:
```json
{
  "summary": "<task.title>",
  "description": "<task.description>",
  "start": { "dateTime": "<chunk.start.toISOString()>" },
  "end":   { "dateTime": "<chunk.end.toISOString()>" }
}
```

---

## Calendar sync

`calendar.calendarList.list()` returns all calendars the user has access to.
Upsert each into `googleCalendars` table keyed on `(googleAccountId, calendarId)`.

---

## Error codes

| HTTP code | Domain error |
|---|---|
| 401 / 403 | `GCalAuthError` |
| 404 | `GCalNotFoundError` |
| 429 | `GCalRateLimitError` |
| other | `GCalError` |
