# Phase 2 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the GCal layer, LLM abstraction, plugin host, job queue, schedule-on-write, scratchpad, and plugin API routes so the full Phase 2 backend is operational.

**Architecture:** GCal calls are isolated in `lib/gcal/` and injected into the scheduler via `GCalAdapter`. LLM calls are abstracted in `lib/llm/` using the Vercel AI SDK. The scratchpad dispatches to plugins via `lib/plugins/host.ts`; only the bundled `text-to-tasks` plugin ships in v1. Background work goes through the `jobs` table; the drain route is called by Vercel Cron (daily) and self-triggered (fire-and-forget) after batch operations.

**Tech Stack:** Next.js 16 App Router, Drizzle/Neon, googleapis, Vercel AI SDK (`ai`), `@ai-sdk/openai`, `@ai-sdk/anthropic`, Vitest, Zod

---

## File map

### New files
| File | Responsibility |
|---|---|
| `references/gcal-integration.md` | GCal spec doc |
| `lib/gcal/errors.ts` | Google API error → domain error |
| `lib/gcal/auth.ts` | OAuth2 client from DB tokens + auto-refresh |
| `lib/gcal/freebusy.ts` | Free/busy query |
| `lib/gcal/events.ts` | Event upsert + delete |
| `lib/gcal/calendars.ts` | Sync calendar list from GCal API to DB |
| `lib/gcal/adapter.ts` | `GCalAdapter` implementation for runner.ts |
| `lib/llm/index.ts` | `complete()` + `completeStructured()` via Vercel AI SDK |
| `lib/plugins/types.ts` | `ScratchpadPlugin` interface + Zod schemas |
| `lib/plugins/context.ts` | `PluginContext` factory backed by `scratchpadPluginConfigs` |
| `lib/plugins/host.ts` | Plugin registry, dispatcher, lifecycle |
| `lib/plugins/builtin/text-to-tasks/prompts.ts` | LLM prompt templates |
| `lib/plugins/builtin/text-to-tasks/plugin.ts` | `TextToTasksPlugin` implementation |
| `lib/plugins/builtin/text-to-tasks/index.ts` | Re-export |
| `lib/plugins/builtin/text-to-tasks/manifest.json` | Plugin metadata |
| `lib/services/jobs.ts` | `enqueueJob`, `claimPendingJobs`, `markJobDone/Failed` |
| `lib/services/scratchpad.ts` | Scratchpad CRUD + process + commit |
| `app/api/cron/drain/route.ts` | Vercel Cron drain handler |
| `app/api/schedule/run/route.ts` | Manual full-run trigger |
| `app/api/scratchpad/route.ts` | GET list, POST create |
| `app/api/scratchpad/[id]/route.ts` | GET, DELETE |
| `app/api/scratchpad/[id]/process/route.ts` | POST — dispatch to plugin |
| `app/api/scratchpad/[id]/commit/route.ts` | POST — create tasks + enqueue + self-drain |
| `app/api/plugins/route.ts` | GET list plugins |
| `app/api/plugins/[name]/route.ts` | GET detail, PATCH config |
| `app/api/calendars/sync/route.ts` | POST — sync GCal calendar list to DB |
| `tests/unit/gcal/errors.test.ts` | |
| `tests/unit/gcal/freebusy.test.ts` | |
| `tests/unit/gcal/events.test.ts` | |
| `tests/unit/gcal/calendars.test.ts` | |
| `tests/unit/llm/index.test.ts` | |
| `tests/unit/plugins/context.test.ts` | |
| `tests/unit/plugins/text-to-tasks.test.ts` | |
| `tests/unit/plugins/host.test.ts` | |
| `tests/unit/services/jobs.test.ts` | |
| `tests/unit/services/scratchpad.test.ts` | |
| `tests/integration/drain.test.ts` | |
| `tests/integration/scratchpad.test.ts` | |
| `tests/integration/plugins.test.ts` | |

### Modified files
| File | Change |
|---|---|
| `package.json` | Add `googleapis`, `@ai-sdk/openai`, `@ai-sdk/anthropic`; remove `@better-auth/infra` |
| `.env` / `.env.example` | Add `LLM_PROVIDER`, `LLM_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_URL` |
| `app/api/tasks/route.ts` | Enqueue `schedule:single-task` job + self-trigger drain after POST |
| `app/api/tasks/[id]/route.ts` | Same after PATCH when `schedulable` fields change |
| `tests/integration/tasks.test.ts` | Update to account for job enqueue side-effect |

---

## Task 1: Dependencies + GCal spec doc

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `references/gcal-integration.md`

- [ ] **Step 1: Install / remove packages**

```bash
pnpm add googleapis @ai-sdk/openai @ai-sdk/anthropic
pnpm remove @better-auth/infra
```

Expected: no errors, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add LLM env vars to `.env.example`**

Add after the Google OAuth block:

```
# --- LLM ---
# Provider: 'openai' | 'anthropic' | 'ollama' (default: openai)
LLM_PROVIDER=openai
# Model ID for the chosen provider (default: gpt-4o-mini / claude-haiku-4-5)
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
# Only needed when LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434/v1
```

- [ ] **Step 3: Create `references/gcal-integration.md`**

```markdown
# GCal Integration — Kairos

Reference doc for `lib/gcal/`. Read before touching any GCal file.

---

## Module map (ADR-R2)

\`\`\`
lib/gcal/
├── errors.ts      # GoogleApiError → domain error mapping
├── auth.ts        # OAuth2 client from DB tokens + token auto-refresh
├── freebusy.ts    # Free/busy queries via calendar.freebusy.query()
├── events.ts      # Event upsert (insert or update) + delete
├── calendars.ts   # Sync calendar list from GCal API → googleCalendars table
└── adapter.ts     # GCalAdapter implementation injected into runner.ts
\`\`\`

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
\`\`\`json
{
  "summary": "<task.title>",
  "description": "<task.description>",
  "start": { "dateTime": "<chunk.start.toISOString()>" },
  "end":   { "dateTime": "<chunk.end.toISOString()>" }
}
\`\`\`

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
```

- [ ] **Step 4: Commit**

```bash
git add references/gcal-integration.md .env.example package.json pnpm-lock.yaml
git commit -m "chore: add googleapis + ai-sdk providers, gcal-integration spec doc"
```

---

## Task 2: GCal errors module

**Files:**
- Create: `lib/gcal/errors.ts`
- Create: `tests/unit/gcal/errors.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/gcal/errors.test.ts
import { describe, it, expect } from 'vitest';
import { mapGoogleError, GCalAuthError, GCalNotFoundError, GCalRateLimitError, GCalError } from '@/lib/gcal/errors';

describe('mapGoogleError', () => {
  it('maps 401 to GCalAuthError', () => {
    expect(mapGoogleError({ code: 401, message: 'Unauthorized' })).toBeInstanceOf(GCalAuthError);
  });
  it('maps 403 to GCalAuthError', () => {
    expect(mapGoogleError({ code: 403, message: 'Forbidden' })).toBeInstanceOf(GCalAuthError);
  });
  it('maps 404 to GCalNotFoundError', () => {
    expect(mapGoogleError({ code: 404, message: 'Not found' })).toBeInstanceOf(GCalNotFoundError);
  });
  it('maps 429 to GCalRateLimitError', () => {
    expect(mapGoogleError({ code: 429, message: 'Rate limited' })).toBeInstanceOf(GCalRateLimitError);
  });
  it('maps unknown to GCalError', () => {
    expect(mapGoogleError({ code: 500, message: 'oops' })).toBeInstanceOf(GCalError);
  });
  it('preserves message', () => {
    const err = mapGoogleError({ code: 404, message: 'Event gone' });
    expect(err.message).toBe('Event gone');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/gcal/errors.test.ts
```

Expected: `Cannot find module '@/lib/gcal/errors'`

- [ ] **Step 3: Implement**

```typescript
// lib/gcal/errors.ts

export class GCalError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'GCalError';
  }
}

export class GCalAuthError extends GCalError {
  constructor(message: string) { super(message, 'AUTH_ERROR'); this.name = 'GCalAuthError'; }
}

export class GCalNotFoundError extends GCalError {
  constructor(message: string) { super(message, 'NOT_FOUND'); this.name = 'GCalNotFoundError'; }
}

export class GCalRateLimitError extends GCalError {
  constructor(message: string) { super(message, 'RATE_LIMIT'); this.name = 'GCalRateLimitError'; }
}

export function mapGoogleError(error: unknown): GCalError {
  const e = error as { code?: number; message?: string };
  const msg = e.message ?? 'Google Calendar error';
  if (e.code === 401 || e.code === 403) return new GCalAuthError(msg);
  if (e.code === 404) return new GCalNotFoundError(msg);
  if (e.code === 429) return new GCalRateLimitError(msg);
  return new GCalError(msg);
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/gcal/errors.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/gcal/errors.ts tests/unit/gcal/errors.test.ts
git commit -m "feat: GCal errors module"
```

---

## Task 3: GCal auth module

**Files:**
- Create: `lib/gcal/auth.ts`

Note: `auth.ts` has no standalone unit test — it talks directly to DB and googleapis. It is exercised via integration tests in later tasks.

- [ ] **Step 1: Implement**

The Better Auth `account` table (from `lib/db/schema/auth.ts`) stores `accessToken` and `refreshToken` for the Google provider. Read from it, not from `googleAccounts`.

```typescript
// lib/gcal/auth.ts
import { google } from 'googleapis';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { account } from '@/lib/db/schema';
import { GCalAuthError } from './errors';

export async function getAuthClient(userId: string) {
  const [row] = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, 'google'),
      ),
    );

  if (!row) throw new GCalAuthError('No Google account connected for this user');

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: row.accessTokenExpiresAt?.getTime(),
  });

  // When googleapis auto-refreshes, persist the new token to DB
  oauth2.on('tokens', async (tokens) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (tokens.access_token) patch.accessToken = tokens.access_token;
    if (tokens.expiry_date) patch.accessTokenExpiresAt = new Date(tokens.expiry_date);
    await db.update(account).set(patch).where(eq(account.id, row.id));
  });

  return oauth2;
}
```

- [ ] **Step 2: Check the Better Auth `account` schema matches**

Read `lib/db/schema/auth.ts` and confirm the column names used above (`accessToken`, `refreshToken`, `accessTokenExpiresAt`, `providerId`) match. Adjust if different.

- [ ] **Step 3: Commit**

```bash
git add lib/gcal/auth.ts
git commit -m "feat: GCal auth module — OAuth2 client from DB tokens"
```

---

## Task 4: GCal freebusy module

**Files:**
- Create: `lib/gcal/freebusy.ts`
- Create: `tests/unit/gcal/freebusy.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/gcal/freebusy.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/gcal/auth', () => ({
  getAuthClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('googleapis', () => {
  const mockQuery = vi.fn();
  return {
    google: {
      calendar: () => ({
        freebusy: { query: mockQuery },
      }),
    },
    __mockQuery: mockQuery,
  };
});

import { getFreeBusy } from '@/lib/gcal/freebusy';
import { google, __mockQuery } from 'googleapis';

describe('getFreeBusy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns merged busy intervals from all calendars', async () => {
    (__mockQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        calendars: {
          'cal1': { busy: [{ start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z' }] },
          'cal2': { busy: [{ start: '2026-01-01T11:00:00Z', end: '2026-01-01T12:00:00Z' }] },
        },
      },
    });

    const result = await getFreeBusy('user1', ['cal1', 'cal2'], new Date('2026-01-01'), new Date('2026-01-02'));
    expect(result).toHaveLength(2);
    expect(result[0].start).toEqual(new Date('2026-01-01T09:00:00Z'));
    expect(result[1].start).toEqual(new Date('2026-01-01T11:00:00Z'));
  });

  it('returns empty array when no calendars given', async () => {
    const result = await getFreeBusy('user1', [], new Date('2026-01-01'), new Date('2026-01-02'));
    expect(result).toEqual([]);
  });

  it('returns empty array when calendars have no busy intervals', async () => {
    (__mockQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { calendars: { 'cal1': { busy: [] } } },
    });
    const result = await getFreeBusy('user1', ['cal1'], new Date('2026-01-01'), new Date('2026-01-02'));
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/gcal/freebusy.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// lib/gcal/freebusy.ts
import { google } from 'googleapis';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';
import type { BusyInterval } from '@/lib/scheduler/types';

export async function getFreeBusy(
  userId: string,
  calendarIds: string[],
  start: Date,
  end: Date,
): Promise<BusyInterval[]> {
  if (calendarIds.length === 0) return [];

  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      },
    });

    const intervals: BusyInterval[] = [];
    for (const cal of Object.values(res.data.calendars ?? {})) {
      for (const busy of (cal as { busy?: { start?: string; end?: string }[] }).busy ?? []) {
        if (busy.start && busy.end) {
          intervals.push({ start: new Date(busy.start), end: new Date(busy.end) });
        }
      }
    }
    return intervals;
  } catch (e) {
    throw mapGoogleError(e);
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/gcal/freebusy.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/gcal/freebusy.ts tests/unit/gcal/freebusy.test.ts
git commit -m "feat: GCal freebusy module"
```

---

## Task 5: GCal events module

**Files:**
- Create: `lib/gcal/events.ts`
- Create: `tests/unit/gcal/events.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/gcal/events.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/gcal/auth', () => ({
  getAuthClient: vi.fn().mockResolvedValue({}),
}));

const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'new-event-id' } });
const mockUpdate = vi.fn().mockResolvedValue({ data: { id: 'existing-event-id' } });
const mockDelete = vi.fn().mockResolvedValue({});

vi.mock('googleapis', () => ({
  google: {
    calendar: () => ({
      events: { insert: mockInsert, update: mockUpdate, delete: mockDelete },
    }),
  },
}));

import { upsertEvent, deleteEvent } from '@/lib/gcal/events';

const chunk = { start: new Date('2026-01-01T09:00:00Z'), end: new Date('2026-01-01T10:00:00Z'), chunkIndex: 0 };
const task = { id: 't1', title: 'Do thing', description: null } as never;

describe('upsertEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts when no existingEventId', async () => {
    const id = await upsertEvent('user1', 'primary', task, chunk);
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(id).toBe('new-event-id');
  });

  it('updates when existingEventId is provided', async () => {
    const id = await upsertEvent('user1', 'primary', task, chunk, 'existing-event-id');
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(id).toBe('existing-event-id');
  });
});

describe('deleteEvent', () => {
  it('calls calendar.events.delete', async () => {
    await deleteEvent('user1', 'primary', 'evt1');
    expect(mockDelete).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'evt1' });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/gcal/events.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// lib/gcal/events.ts
import { google } from 'googleapis';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';
import type { Task, PlacedChunk } from '@/lib/scheduler/types';

export async function upsertEvent(
  userId: string,
  calendarId: string,
  task: Task,
  chunk: PlacedChunk,
  existingEventId?: string | null,
): Promise<string> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const body = {
    summary: task.title,
    description: task.description ?? undefined,
    start: { dateTime: chunk.start.toISOString() },
    end: { dateTime: chunk.end.toISOString() },
  };

  try {
    if (existingEventId) {
      const res = await calendar.events.update({ calendarId, eventId: existingEventId, requestBody: body });
      return res.data.id!;
    }
    const res = await calendar.events.insert({ calendarId, requestBody: body });
    return res.data.id!;
  } catch (e) {
    throw mapGoogleError(e);
  }
}

export async function deleteEvent(
  userId: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    throw mapGoogleError(e);
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/gcal/events.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/gcal/events.ts tests/unit/gcal/events.test.ts
git commit -m "feat: GCal events module"
```

---

## Task 6: GCal calendars sync + adapter

**Files:**
- Create: `lib/gcal/calendars.ts`
- Create: `lib/gcal/adapter.ts`
- Create: `tests/unit/gcal/calendars.test.ts`

- [ ] **Step 1: Write failing test for calendars sync**

```typescript
// tests/unit/gcal/calendars.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/gcal/auth', () => ({
  getAuthClient: vi.fn().mockResolvedValue({}),
}));

const mockList = vi.fn();
vi.mock('googleapis', () => ({
  google: {
    calendar: () => ({ calendarList: { list: mockList } }),
  },
}));

vi.mock('@/lib/db/client', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

import { syncCalendars } from '@/lib/gcal/calendars';

describe('syncCalendars', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no calendars returned', async () => {
    mockList.mockResolvedValue({ data: { items: [] } });

    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'ga1', googleAccountId: 'gaid1' }]),
      }),
    });

    const result = await syncCalendars('user1');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/gcal/calendars.test.ts
```

- [ ] **Step 3: Implement `lib/gcal/calendars.ts`**

```typescript
// lib/gcal/calendars.ts
import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleAccounts, googleCalendars } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';

export async function syncCalendars(userId: string) {
  const [gaRow] = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));

  if (!gaRow) return [];

  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  let items: { id?: string | null; summary?: string | null; backgroundColor?: string | null; primary?: boolean | null }[] = [];
  try {
    const res = await calendar.calendarList.list();
    items = res.data.items ?? [];
  } catch (e) {
    throw mapGoogleError(e);
  }

  const upserted = await Promise.all(
    items
      .filter((item) => !!item.id)
      .map(async (item) => {
        const existing = await db
          .select()
          .from(googleCalendars)
          .where(eq(googleCalendars.calendarId, item.id!));

        if (existing[0]) {
          const [updated] = await db
            .update(googleCalendars)
            .set({ name: item.summary ?? '', color: item.backgroundColor, updatedAt: new Date() })
            .where(eq(googleCalendars.id, existing[0].id))
            .returning();
          return updated!;
        }

        const [inserted] = await db
          .insert(googleCalendars)
          .values({
            id: newId(),
            userId,
            googleAccountId: gaRow.id,
            calendarId: item.id!,
            name: item.summary ?? '',
            color: item.backgroundColor,
            isPrimary: item.primary ?? false,
          })
          .returning();
        return inserted!;
      }),
  );

  return upserted;
}
```

- [ ] **Step 4: Implement `lib/gcal/adapter.ts`**

```typescript
// lib/gcal/adapter.ts
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';
import type { GCalAdapter } from '@/lib/scheduler/runner';
import { getFreeBusy } from './freebusy';
import { upsertEvent } from './events';

export function createGCalAdapter(userId: string): GCalAdapter {
  return {
    async getFreeBusy(calendarIds, start, end) {
      let ids = calendarIds;
      if (ids.length === 0) {
        const rows = await db
          .select({ calendarId: googleCalendars.calendarId })
          .from(googleCalendars)
          .where(and(eq(googleCalendars.userId, userId), eq(googleCalendars.selected, true)));
        ids = rows.map((r) => r.calendarId);
      }
      if (ids.length === 0) return [];
      return getFreeBusy(userId, ids, start, end);
    },

    async upsertEvent(calendarId, task, chunk, existingEventId) {
      return upsertEvent(userId, calendarId, task, chunk, existingEventId);
    },
  };
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test tests/unit/gcal/
```

Expected: all gcal unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/gcal/calendars.ts lib/gcal/adapter.ts tests/unit/gcal/calendars.test.ts
git commit -m "feat: GCal calendars sync + GCalAdapter implementation"
```

---

## Task 7: GCal calendars sync route

**Files:**
- Create: `app/api/calendars/sync/route.ts`

- [ ] **Step 1: Implement**

```typescript
// app/api/calendars/sync/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { syncCalendars } from '@/lib/gcal/calendars';

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const calendars = await syncCalendars(userId);
  return NextResponse.json(calendars);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/calendars/sync/route.ts
git commit -m "feat: POST /api/calendars/sync — sync GCal calendar list to DB"
```

---

## Task 8: LLM abstraction

**Files:**
- Create: `lib/llm/index.ts`
- Create: `tests/unit/llm/index.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/llm/index.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'hello' }),
  generateObject: vi.fn().mockResolvedValue({ object: { name: 'test' } }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => 'mock-openai-model')),
}));

import { complete, completeStructured } from '@/lib/llm';
import { z } from 'zod';

describe('complete', () => {
  it('returns generated text', async () => {
    const result = await complete('Say hello');
    expect(result).toBe('hello');
  });
});

describe('completeStructured', () => {
  it('returns validated object', async () => {
    const schema = z.object({ name: z.string() });
    const result = await completeStructured('Extract name', schema);
    expect(result).toEqual({ name: 'test' });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/llm/index.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// lib/llm/index.ts
import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { z } from 'zod';

type Provider = 'openai' | 'anthropic' | 'ollama';

function resolveModel() {
  const provider = (process.env.LLM_PROVIDER ?? 'openai') as Provider;
  const modelId = process.env.LLM_MODEL ?? (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini');

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    return anthropic(modelId);
  }

  // openai or ollama (ollama is OpenAI-compatible)
  const openai = createOpenAI({
    apiKey: provider === 'ollama' ? 'ollama' : process.env.OPENAI_API_KEY!,
    baseURL: provider === 'ollama' ? (process.env.OLLAMA_URL ?? 'http://localhost:11434/v1') : undefined,
  });
  return openai(modelId);
}

export async function complete(prompt: string): Promise<string> {
  const model = resolveModel();
  const { text } = await generateText({ model, prompt });
  return text;
}

export async function completeStructured<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T> {
  const model = resolveModel();
  const { object } = await generateObject({ model, prompt, schema });
  return object;
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/llm/index.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/index.ts tests/unit/llm/index.test.ts
git commit -m "feat: LLM abstraction — complete() + completeStructured() via Vercel AI SDK"
```

---

## Task 9: Plugin types + context

**Files:**
- Create: `lib/plugins/types.ts`
- Create: `lib/plugins/context.ts`
- Create: `tests/unit/plugins/context.test.ts`

- [ ] **Step 1: Create `lib/plugins/types.ts`** (exact types from the plugin-system spec)

```typescript
// lib/plugins/types.ts
import { z } from 'zod';

export const ScratchpadInputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  inputType: z.enum(['text', 'url', 'share', 'voice', 'file']),
  content: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.date(),
});

export const CandidateTaskSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  durationMins: z.number().int().nullable().optional(),
  deadline: z.date().nullable().optional(),
  priority: z.number().int().min(1).max(4).default(3),
  tags: z.array(z.string()).default([]),
  sourceMetadata: z.record(z.unknown()).default({}),
});

export const ParseResultSchema = z.object({
  pluginName: z.string(),
  pluginVersion: z.string(),
  tasks: z.array(CandidateTaskSchema),
  rawOutput: z.record(z.unknown()),
  warnings: z.array(z.string()).default([]),
});

export type ScratchpadInput = z.infer<typeof ScratchpadInputSchema>;
export type CandidateTask = z.infer<typeof CandidateTaskSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface PluginContext {
  userId: string;
  pluginName: string;
  getConfig<T = Record<string, unknown>>(): Promise<T>;
  setConfig<T = Record<string, unknown>>(config: T): Promise<void>;
  getMemory<T = Record<string, unknown>>(): Promise<T>;
  setMemory<T = Record<string, unknown>>(memory: T): Promise<void>;
  updateMemory(patch: Record<string, unknown>): Promise<void>;
  getRulesets(): Promise<Array<Record<string, unknown>>>;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeStructured<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T>;
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void;
}

export interface ScratchpadPlugin {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  handlesInputTypes: ReadonlyArray<ScratchpadInput['inputType']>;
  canHandle(input: ScratchpadInput): boolean;
  parse(input: ScratchpadInput, context: PluginContext): Promise<ParseResult>;
  onInstall?(context: PluginContext): Promise<void>;
  onUninstall?(context: PluginContext): Promise<void>;
}
```

- [ ] **Step 2: Write failing test for context**

```typescript
// tests/unit/plugins/context.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@/lib/db/client', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));
vi.mock('@/lib/llm', () => ({
  complete: vi.fn().mockResolvedValue('llm response'),
  completeStructured: vi.fn().mockResolvedValue({ tasks: [] }),
}));

import { createPluginContext } from '@/lib/plugins/context';

const existingConfig = {
  id: 'cfg1', userId: 'u1', pluginName: 'test-plugin',
  config: { key: 'val' }, memory: { mem: 1 }, rulesets: [{ if: {}, then: {} }],
  enabled: true, createdAt: new Date(), updatedAt: new Date(),
};

function mockDb(returnVal: unknown) {
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([returnVal]),
    }),
  });
}

describe('PluginContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getConfig returns config from DB', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const config = await ctx.getConfig<{ key: string }>();
    expect(config).toEqual({ key: 'val' });
  });

  it('getMemory returns memory from DB', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const memory = await ctx.getMemory<{ mem: number }>();
    expect(memory).toEqual({ mem: 1 });
  });

  it('getRulesets returns rulesets from DB', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const rulesets = await ctx.getRulesets();
    expect(rulesets).toHaveLength(1);
  });

  it('complete delegates to lib/llm', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const result = await ctx.complete('hello');
    expect(result).toBe('llm response');
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
pnpm test tests/unit/plugins/context.test.ts
```

- [ ] **Step 4: Implement `lib/plugins/context.ts`**

```typescript
// lib/plugins/context.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scratchpadPluginConfigs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { complete as llmComplete, completeStructured as llmCompleteStructured } from '@/lib/llm';
import type { PluginContext, CompletionOptions } from './types';
import type { z } from 'zod';

async function getOrCreate(userId: string, pluginName: string) {
  const [row] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(and(eq(scratchpadPluginConfigs.userId, userId), eq(scratchpadPluginConfigs.pluginName, pluginName)));
  if (row) return row;

  const [created] = await db
    .insert(scratchpadPluginConfigs)
    .values({ id: newId(), userId, pluginName })
    .returning();
  return created!;
}

export function createPluginContext(userId: string, pluginName: string): PluginContext {
  const where = () => and(eq(scratchpadPluginConfigs.userId, userId), eq(scratchpadPluginConfigs.pluginName, pluginName));

  return {
    userId,
    pluginName,

    async getConfig<T>() {
      const row = await getOrCreate(userId, pluginName);
      return row.config as T;
    },

    async setConfig<T>(config: T) {
      await getOrCreate(userId, pluginName);
      await db.update(scratchpadPluginConfigs).set({ config: config as Record<string, unknown>, updatedAt: new Date() }).where(where());
    },

    async getMemory<T>() {
      const row = await getOrCreate(userId, pluginName);
      return row.memory as T;
    },

    async setMemory<T>(memory: T) {
      await getOrCreate(userId, pluginName);
      await db.update(scratchpadPluginConfigs).set({ memory: memory as Record<string, unknown>, updatedAt: new Date() }).where(where());
    },

    async updateMemory(patch) {
      const row = await getOrCreate(userId, pluginName);
      const merged = { ...(row.memory as Record<string, unknown>), ...patch };
      await db.update(scratchpadPluginConfigs).set({ memory: merged, updatedAt: new Date() }).where(where());
    },

    async getRulesets() {
      const row = await getOrCreate(userId, pluginName);
      return row.rulesets as Array<Record<string, unknown>>;
    },

    async complete(prompt: string, _options?: CompletionOptions) {
      return llmComplete(prompt);
    },

    async completeStructured<T>(prompt: string, schema: z.ZodSchema<T>) {
      return llmCompleteStructured(prompt, schema);
    },

    log(level, message, fields) {
      console[level](`[plugin:${pluginName}]`, message, fields ?? '');
    },
  };
}
```

- [ ] **Step 5: Run to confirm pass**

```bash
pnpm test tests/unit/plugins/context.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/plugins/types.ts lib/plugins/context.ts tests/unit/plugins/context.test.ts
git commit -m "feat: plugin types + PluginContext factory"
```

---

## Task 10: text-to-tasks bundled plugin

**Files:**
- Create: `lib/plugins/builtin/text-to-tasks/prompts.ts`
- Create: `lib/plugins/builtin/text-to-tasks/plugin.ts`
- Create: `lib/plugins/builtin/text-to-tasks/index.ts`
- Create: `lib/plugins/builtin/text-to-tasks/manifest.json`
- Create: `tests/unit/plugins/text-to-tasks.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/plugins/text-to-tasks.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TextToTasksPlugin } from '@/lib/plugins/builtin/text-to-tasks';
import type { ScratchpadInput, PluginContext } from '@/lib/plugins/types';

const plugin = new TextToTasksPlugin();

const input: ScratchpadInput = {
  id: 's1', userId: 'u1', inputType: 'text',
  content: 'Reply to John about the proposal',
  payload: {}, createdAt: new Date(),
};

const mockContext = {
  userId: 'u1', pluginName: 'text-to-tasks',
  completeStructured: vi.fn().mockResolvedValue({
    tasks: [{ title: 'Reply to John about the proposal', priority: 3, tags: ['email'], durationMins: 10 }],
  }),
  getRulesets: vi.fn().mockResolvedValue([]),
  log: vi.fn(),
} as unknown as PluginContext;

describe('TextToTasksPlugin', () => {
  it('canHandle returns true for text input', () => {
    expect(plugin.canHandle(input)).toBe(true);
  });

  it('canHandle returns false for url input', () => {
    expect(plugin.canHandle({ ...input, inputType: 'url' })).toBe(false);
  });

  it('parse returns a ParseResult with tasks', async () => {
    const result = await plugin.parse(input, mockContext);
    expect(result.pluginName).toBe('text-to-tasks');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Reply to John about the proposal');
  });

  it('parse applies rulesets', async () => {
    const ctxWithRuleset = {
      ...mockContext,
      completeStructured: vi.fn().mockResolvedValue({
        tasks: [{ title: 'Send email to Sarah', priority: 3, tags: [], durationMins: null }],
      }),
      getRulesets: vi.fn().mockResolvedValue([
        { if: { contains: 'email' }, then: { tag: 'email', durationMins: 10 } },
      ]),
    } as unknown as PluginContext;

    const result = await plugin.parse(input, ctxWithRuleset);
    expect(result.tasks[0].tags).toContain('email');
    expect(result.tasks[0].durationMins).toBe(10);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/plugins/text-to-tasks.test.ts
```

- [ ] **Step 3: Create `lib/plugins/builtin/text-to-tasks/prompts.ts`**

```typescript
// lib/plugins/builtin/text-to-tasks/prompts.ts
export function buildExtractionPrompt(content: string): string {
  return `Extract actionable tasks from the following text.

For each task return:
- title: clear, actionable, starts with a verb
- description: optional extra context (null if none)
- durationMins: integer estimate in minutes (null if unknown)
- deadline: ISO date string if deadline mentioned (null if none)
- priority: 1=urgent, 2=high, 3=normal, 4=low (default 3)
- tags: string labels like "email", "health", "meetings" — never project names

Only include clearly actionable items. Ignore vague ideas or observations.

Text:
${content}`;
}
```

- [ ] **Step 4: Create `lib/plugins/builtin/text-to-tasks/plugin.ts`**

```typescript
// lib/plugins/builtin/text-to-tasks/plugin.ts
import { z } from 'zod';
import { CandidateTaskSchema, ParseResultSchema } from '@/lib/plugins/types';
import type { ScratchpadPlugin, ScratchpadInput, ParseResult, CandidateTask, PluginContext } from '@/lib/plugins/types';
import { buildExtractionPrompt } from './prompts';

const ExtractionSchema = z.object({ tasks: z.array(CandidateTaskSchema) });

export class TextToTasksPlugin implements ScratchpadPlugin {
  name = 'text-to-tasks';
  version = '1.0.0';
  displayName = 'Text to Tasks';
  description = 'Extracts actionable tasks from plain text using your configured LLM.';
  author = 'Kairos';
  handlesInputTypes = ['text'] as const;

  canHandle(input: ScratchpadInput): boolean {
    return input.inputType === 'text';
  }

  async parse(input: ScratchpadInput, context: PluginContext): Promise<ParseResult> {
    const prompt = buildExtractionPrompt(input.content);
    const { tasks } = await context.completeStructured(prompt, ExtractionSchema);

    const rulesets = await context.getRulesets();
    const processed = applyRulesets(tasks, rulesets);

    context.log('info', 'Extracted tasks', { count: processed.length });

    return ParseResultSchema.parse({
      pluginName: this.name,
      pluginVersion: this.version,
      tasks: processed,
      rawOutput: { tasks },
      warnings: [],
    });
  }
}

function applyRulesets(tasks: CandidateTask[], rulesets: Array<Record<string, unknown>>): CandidateTask[] {
  if (rulesets.length === 0) return tasks;
  return tasks.map((task) => {
    let t = { ...task };
    for (const rule of rulesets) {
      const cond = rule.if as { contains?: string } | undefined;
      const action = rule.then as { tag?: string; durationMins?: number } | undefined;
      if (!cond || !action) continue;
      const text = `${t.title} ${t.description ?? ''}`.toLowerCase();
      if (cond.contains && text.includes(cond.contains.toLowerCase())) {
        if (action.tag && !t.tags.includes(action.tag)) t = { ...t, tags: [...t.tags, action.tag] };
        if (action.durationMins) t = { ...t, durationMins: action.durationMins };
      }
    }
    return t;
  });
}
```

- [ ] **Step 5: Create `lib/plugins/builtin/text-to-tasks/index.ts`**

```typescript
// lib/plugins/builtin/text-to-tasks/index.ts
export { TextToTasksPlugin } from './plugin';
```

- [ ] **Step 6: Create `lib/plugins/builtin/text-to-tasks/manifest.json`**

```json
{
  "name": "text-to-tasks",
  "version": "1.0.0",
  "displayName": "Text to Tasks",
  "description": "Extracts actionable tasks from plain text using your configured LLM.",
  "author": "Kairos",
  "handlesInputTypes": ["text"]
}
```

- [ ] **Step 7: Run to confirm pass**

```bash
pnpm test tests/unit/plugins/text-to-tasks.test.ts
```

Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add lib/plugins/builtin/ tests/unit/plugins/text-to-tasks.test.ts
git commit -m "feat: text-to-tasks bundled plugin"
```

---

## Task 11: Plugin host

**Files:**
- Create: `lib/plugins/host.ts`
- Create: `tests/unit/plugins/host.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/plugins/host.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/lib/plugins/context', () => ({
  createPluginContext: vi.fn().mockReturnValue({
    userId: 'u1', pluginName: 'text-to-tasks',
    complete: vi.fn(), completeStructured: vi.fn(), getRulesets: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn(), setConfig: vi.fn(), getMemory: vi.fn(), setMemory: vi.fn(),
    updateMemory: vi.fn(), log: vi.fn(),
  }),
}));

import { dispatchToPlugin, listPlugins } from '@/lib/plugins/host';
import type { ScratchpadInput } from '@/lib/plugins/types';

const textInput: ScratchpadInput = {
  id: 's1', userId: 'u1', inputType: 'text', content: 'do something', payload: {}, createdAt: new Date(),
};

describe('listPlugins', () => {
  it('returns the bundled text-to-tasks plugin', () => {
    const plugins = listPlugins();
    expect(plugins.some((p) => p.name === 'text-to-tasks')).toBe(true);
  });
});

describe('dispatchToPlugin', () => {
  it('routes text input to text-to-tasks plugin', async () => {
    const { createPluginContext } = await import('@/lib/plugins/context');
    const ctx = (createPluginContext as ReturnType<typeof vi.fn>)();
    ctx.completeStructured = vi.fn().mockResolvedValue({ tasks: [{ title: 'do something', priority: 3, tags: [] }] });

    await expect(dispatchToPlugin(textInput, 'u1')).resolves.toMatchObject({ pluginName: 'text-to-tasks' });
  });

  it('throws when no plugin can handle the input type', async () => {
    const voiceInput: ScratchpadInput = { ...textInput, inputType: 'voice' };
    await expect(dispatchToPlugin(voiceInput, 'u1')).rejects.toThrow('No plugin can handle');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/plugins/host.test.ts
```

- [ ] **Step 3: Implement `lib/plugins/host.ts`**

```typescript
// lib/plugins/host.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scratchpadPluginConfigs } from '@/lib/db/schema';
import { createPluginContext } from './context';
import { TextToTasksPlugin } from './builtin/text-to-tasks';
import type { ScratchpadPlugin, ScratchpadInput, ParseResult } from './types';

const BUNDLED: ScratchpadPlugin[] = [new TextToTasksPlugin()];
const registry = new Map<string, ScratchpadPlugin>();

function ensureRegistry() {
  if (registry.size > 0) return;
  for (const p of BUNDLED) registry.set(p.name, p);
}

async function enabledNames(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ pluginName: scratchpadPluginConfigs.pluginName, enabled: scratchpadPluginConfigs.enabled })
    .from(scratchpadPluginConfigs)
    .where(eq(scratchpadPluginConfigs.userId, userId));

  const disabled = new Set(rows.filter((r) => !r.enabled).map((r) => r.pluginName));
  return new Set(BUNDLED.map((p) => p.name).filter((n) => !disabled.has(n)));
}

export async function dispatchToPlugin(input: ScratchpadInput, userId: string): Promise<ParseResult> {
  ensureRegistry();
  const enabled = await enabledNames(userId);

  for (const plugin of BUNDLED) {
    if (!enabled.has(plugin.name)) continue;
    if (!plugin.canHandle(input)) continue;
    const context = createPluginContext(userId, plugin.name);
    return plugin.parse(input, context);
  }

  throw new Error(`No plugin can handle input type: ${input.inputType}`);
}

export function listPlugins(): ScratchpadPlugin[] {
  ensureRegistry();
  return [...BUNDLED];
}

export async function getPluginWithConfig(userId: string, pluginName: string) {
  ensureRegistry();
  const plugin = registry.get(pluginName);
  if (!plugin) return null;

  const [cfg] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(eq(scratchpadPluginConfigs.userId, userId));

  return {
    name: plugin.name,
    version: plugin.version,
    displayName: plugin.displayName,
    description: plugin.description,
    enabled: cfg?.enabled ?? true,
    config: cfg?.config ?? {},
    rulesets: cfg?.rulesets ?? [],
  };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/plugins/host.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/plugins/host.ts tests/unit/plugins/host.test.ts
git commit -m "feat: plugin host — registry, dispatcher, getPluginWithConfig"
```

---

## Task 12: Jobs service

**Files:**
- Create: `lib/services/jobs.ts`
- Create: `tests/unit/services/jobs.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/services/jobs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/db/client', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
}));
vi.mock('@/lib/utils/id', () => ({ newId: vi.fn(() => 'job-id-1') }));

import { enqueueJob, markJobDone, markJobFailed } from '@/lib/services/jobs';

describe('enqueueJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a job with the given type and payload', async () => {
    const chainMock = { values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'job-id-1' }]) }) }) };
    mockInsert.mockReturnValue(chainMock);

    const job = await enqueueJob('schedule:single-task', { userId: 'u1', payload: { taskId: 't1' } });
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(job?.id).toBe('job-id-1');
  });
});

describe('markJobDone', () => {
  it('sets status to done', async () => {
    const chainMock = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
    mockUpdate.mockReturnValue(chainMock);

    await markJobDone('job-id-1');
    expect(chainMock.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/services/jobs.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// lib/services/jobs.ts
import { and, eq, inArray, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { jobs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type JobType = 'schedule:single-task' | 'schedule:full-run';

export interface EnqueueOptions {
  userId?: string;
  payload?: Record<string, unknown>;
  runAfter?: Date;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export async function enqueueJob(type: JobType, options: EnqueueOptions = {}) {
  const [job] = await db
    .insert(jobs)
    .values({
      id: newId(),
      type,
      userId: options.userId,
      payload: options.payload ?? {},
      runAfter: options.runAfter ?? new Date(),
      idempotencyKey: options.idempotencyKey,
      maxAttempts: options.maxAttempts ?? 3,
    })
    .onConflictDoNothing()
    .returning();
  return job ?? null;
}

export async function claimPendingJobs(limit = 5) {
  const pending = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.status, 'pending'), lte(jobs.runAfter, new Date())))
    .limit(limit);

  if (pending.length === 0) return [];

  return db
    .update(jobs)
    .set({ status: 'running', attempts: sql`${jobs.attempts} + 1`, updatedAt: new Date() })
    .where(inArray(jobs.id, pending.map((j) => j.id)))
    .returning();
}

export async function markJobDone(id: string) {
  await db.update(jobs).set({ status: 'done', updatedAt: new Date() }).where(eq(jobs.id, id));
}

export async function markJobFailed(id: string, error: string, maxAttempts: number, attempts: number) {
  const status = attempts >= maxAttempts ? 'dead' : 'pending';
  await db.update(jobs).set({ status, lastError: error, updatedAt: new Date() }).where(eq(jobs.id, id));
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/services/jobs.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/services/jobs.ts tests/unit/services/jobs.test.ts
git commit -m "feat: jobs service — enqueueJob, claimPendingJobs, markJobDone/Failed"
```

---

## Task 13: Cron drain route

**Files:**
- Create: `app/api/cron/drain/route.ts`
- Create: `tests/integration/drain.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/integration/drain.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/jobs', () => ({
  claimPendingJobs: vi.fn().mockResolvedValue([]),
  markJobDone: vi.fn(),
  markJobFailed: vi.fn(),
}));
vi.mock('@/lib/scheduler/runner', () => ({ scheduleSingleTask: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/gcal/adapter', () => ({ createGCalAdapter: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ db: { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }) } }));

import { GET } from '@/app/api/cron/drain/route';

describe('GET /api/cron/drain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with drain summary when no jobs pending', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ drained: 0, succeeded: 0, failed: 0 });
  });

  it('processes a schedule:single-task job', async () => {
    const { claimPendingJobs } = await import('@/lib/services/jobs');
    const { scheduleSingleTask } = await import('@/lib/scheduler/runner');
    (claimPendingJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'j1', type: 'schedule:single-task', payload: { taskId: 't1' }, userId: 'u1', maxAttempts: 3, attempts: 1 },
    ]);

    await GET();
    expect(scheduleSingleTask).toHaveBeenCalledWith('u1', 't1', undefined);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/integration/drain.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// app/api/cron/drain/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleAccounts } from '@/lib/db/schema';
import { claimPendingJobs, markJobDone, markJobFailed } from '@/lib/services/jobs';
import { scheduleSingleTask, scheduleFullRunChunk } from '@/lib/scheduler/runner';
import { createGCalAdapter } from '@/lib/gcal/adapter';
import type { Job } from '@/lib/db/schema/jobs';

const DRAIN_LIMIT = 5;

async function getGcal(userId: string | null) {
  if (!userId) return undefined;
  const [acct] = await db.select({ id: googleAccounts.id }).from(googleAccounts).where(eq(googleAccounts.userId, userId));
  return acct ? createGCalAdapter(userId) : undefined;
}

async function processJob(job: Job) {
  const payload = job.payload as Record<string, unknown>;

  if (job.type === 'schedule:single-task') {
    const { taskId } = payload as { taskId: string };
    const gcal = await getGcal(job.userId ?? null);
    await scheduleSingleTask(job.userId!, taskId, gcal);
    return;
  }

  if (job.type === 'schedule:full-run') {
    const gcal = await getGcal(job.userId ?? null);
    const { remaining } = await scheduleFullRunChunk(job.userId!, gcal);
    if (remaining > 0) {
      // Enqueue follow-up (import here to avoid circular dep at module level)
      const { enqueueJob } = await import('@/lib/services/jobs');
      await enqueueJob('schedule:full-run', { userId: job.userId ?? undefined });
    }
    return;
  }

  throw new Error(`Unknown job type: ${job.type}`);
}

async function drain() {
  const claimed = await claimPendingJobs(DRAIN_LIMIT);
  const results = await Promise.allSettled(
    claimed.map(async (job) => {
      try {
        await processJob(job);
        await markJobDone(job.id);
      } catch (e) {
        await markJobFailed(job.id, String(e), job.maxAttempts, job.attempts);
        throw e;
      }
    }),
  );

  return {
    drained: claimed.length,
    succeeded: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}

export async function GET() {
  const summary = await drain();
  return NextResponse.json(summary);
}

export { GET as POST };
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/integration/drain.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/drain/route.ts tests/integration/drain.test.ts
git commit -m "feat: cron drain route — processes schedule:single-task and schedule:full-run jobs"
```

---

## Task 14: Schedule-on-write hook

**Files:**
- Modify: `app/api/tasks/route.ts`
- Modify: `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Update `app/api/tasks/route.ts` POST handler**

After `const task = await createTask(userId, parsed.data);`, add:

```typescript
// Enqueue placement if task is schedulable, then self-trigger drain (fire-and-forget)
if (parsed.data.schedulable !== false) {
  await enqueueJob('schedule:single-task', {
    userId,
    payload: { taskId: task.id },
    idempotencyKey: `schedule:single-task:${task.id}`,
  });
  fetch(new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(), {
    method: 'POST',
  }).catch(() => {/* fire-and-forget */});
}
```

Add import at top:

```typescript
import { enqueueJob } from '@/lib/services/jobs';
```

- [ ] **Step 2: Update `app/api/tasks/[id]/route.ts` PATCH handler**

After `const task = await updateTask(userId, id, parsed.data);`, add:

```typescript
// Re-schedule if scheduling-related fields changed
const scheduleFields: (keyof typeof parsed.data)[] = ['durationMins', 'deadline', 'priority', 'schedulable', 'bufferMins', 'isSplittable', 'dependsOn'];
const touchesSchedule = scheduleFields.some((f) => f in parsed.data);
if (task && touchesSchedule && parsed.data.schedulable !== false) {
  await enqueueJob('schedule:single-task', {
    userId,
    payload: { taskId: id },
    idempotencyKey: `schedule:single-task:${id}:${Date.now()}`,
  });
  fetch(new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(), {
    method: 'POST',
  }).catch(() => {/* fire-and-forget */});
}
```

Add import at top:

```typescript
import { enqueueJob } from '@/lib/services/jobs';
```

- [ ] **Step 3: Run existing task tests to confirm nothing broke**

```bash
pnpm test tests/integration/tasks.test.ts
```

If tests fail because they don't mock `enqueueJob`, add to the test file's vi.mock calls:

```typescript
vi.mock('@/lib/services/jobs', () => ({ enqueueJob: vi.fn().mockResolvedValue(null) }));
```

- [ ] **Step 4: Commit**

```bash
git add app/api/tasks/route.ts app/api/tasks/[id]/route.ts tests/integration/tasks.test.ts
git commit -m "feat: schedule-on-write — enqueue placement job + self-trigger drain on task create/update"
```

---

## Task 15: Schedule run route

**Files:**
- Create: `app/api/schedule/run/route.ts`

- [ ] **Step 1: Implement**

```typescript
// app/api/schedule/run/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { enqueueJob } from '@/lib/services/jobs';

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const job = await enqueueJob('schedule:full-run', {
    userId,
    idempotencyKey: `schedule:full-run:${userId}:${new Date().toISOString().slice(0, 13)}`, // once per hour
  });

  // Self-trigger drain
  fetch(new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(), {
    method: 'POST',
  }).catch(() => {});

  return NextResponse.json({ jobId: job?.id ?? null, status: 'queued' });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/schedule/run/route.ts
git commit -m "feat: POST /api/schedule/run — enqueue full schedule run"
```

---

## Task 16: Scratchpad service

**Files:**
- Create: `lib/services/scratchpad.ts`
- Create: `tests/unit/services/scratchpad.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/services/scratchpad.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => {
  const chainSelect = { from: vi.fn(), where: vi.fn(), returning: vi.fn() };
  chainSelect.from.mockReturnValue(chainSelect);
  chainSelect.where.mockReturnValue(chainSelect);
  chainSelect.returning.mockReturnValue(chainSelect);
  return {
    db: {
      select: vi.fn().mockReturnValue(chainSelect),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'sp1', userId: 'u1', content: 'hello', inputType: 'text', processed: false, parseResult: null, extractedTaskIds: [], inputPayload: {}, createdAt: new Date(), updatedAt: new Date() }]) }) }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'sp1' }]) }) }),
    },
  };
});
vi.mock('@/lib/utils/id', () => ({ newId: vi.fn(() => 'sp1') }));

import { createScratchpad } from '@/lib/services/scratchpad';

describe('createScratchpad', () => {
  it('returns a new scratchpad entry', async () => {
    const result = await createScratchpad('u1', { content: 'hello', inputType: 'text' });
    expect(result.id).toBe('sp1');
    expect(result.content).toBe('hello');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/unit/services/scratchpad.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// lib/services/scratchpad.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scratchpads, tasks, taskTags, tags } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { dispatchToPlugin } from '@/lib/plugins/host';
import type { ScratchpadInput } from '@/lib/plugins/types';

export type Scratchpad = typeof scratchpads.$inferSelect;

export interface CreateScratchpadInput {
  content: string;
  inputType: 'text' | 'url' | 'share' | 'voice' | 'file';
  title?: string;
  inputPayload?: Record<string, unknown>;
}

export async function createScratchpad(userId: string, input: CreateScratchpadInput): Promise<Scratchpad> {
  const [row] = await db
    .insert(scratchpads)
    .values({
      id: newId(),
      userId,
      content: input.content,
      inputType: input.inputType,
      title: input.title,
      inputPayload: input.inputPayload ?? {},
      updatedAt: new Date(),
    })
    .returning();
  return row!;
}

export async function listScratchpads(userId: string): Promise<Scratchpad[]> {
  return db.select().from(scratchpads).where(eq(scratchpads.userId, userId));
}

export async function getScratchpad(userId: string, id: string): Promise<Scratchpad | null> {
  const [row] = await db
    .select()
    .from(scratchpads)
    .where(and(eq(scratchpads.id, id), eq(scratchpads.userId, userId)));
  return row ?? null;
}

export async function deleteScratchpad(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(scratchpads)
    .where(and(eq(scratchpads.id, id), eq(scratchpads.userId, userId)))
    .returning({ id: scratchpads.id });
  return !!deleted;
}

export async function processScratchpad(userId: string, id: string): Promise<Scratchpad | null> {
  const pad = await getScratchpad(userId, id);
  if (!pad) return null;

  const pluginInput: ScratchpadInput = {
    id: pad.id,
    userId,
    inputType: pad.inputType as ScratchpadInput['inputType'],
    content: pad.content,
    payload: (pad.inputPayload ?? {}) as Record<string, unknown>,
    createdAt: pad.createdAt,
  };

  const result = await dispatchToPlugin(pluginInput, userId);

  const [updated] = await db
    .update(scratchpads)
    .set({
      processed: true,
      pluginName: result.pluginName,
      pluginVersion: result.pluginVersion,
      parseResult: result as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(scratchpads.id, id), eq(scratchpads.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function commitScratchpad(userId: string, id: string): Promise<{ taskIds: string[] }> {
  const pad = await getScratchpad(userId, id);
  if (!pad || !pad.parseResult) throw new Error('Scratchpad not processed');

  const parseResult = pad.parseResult as unknown as { tasks: Array<{ title: string; description?: string | null; durationMins?: number | null; deadline?: string | null; priority: number; tags: string[]; sourceMetadata?: Record<string, unknown> }> };
  const taskIds: string[] = [];

  for (const candidate of parseResult.tasks) {
    const taskId = newId();

    await db.insert(tasks).values({
      id: taskId,
      userId,
      title: candidate.title,
      description: candidate.description ?? undefined,
      durationMins: candidate.durationMins ?? undefined,
      deadline: candidate.deadline ? new Date(candidate.deadline) : undefined,
      priority: candidate.priority,
      source: `scratchpad:${pad.pluginName ?? 'unknown'}`,
      sourceRef: pad.id,
      sourceMetadata: candidate.sourceMetadata ?? {},
      updatedAt: new Date(),
    });

    // Create tags if needed and link them
    if (candidate.tags.length > 0) {
      for (const tagName of candidate.tags) {
        const existing = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
        let tagId = existing[0]?.id;
        if (!tagId) {
          tagId = newId();
          await db.insert(tags).values({ id: tagId, userId, name: tagName, updatedAt: new Date() });
        }
        await db.insert(taskTags).values({ taskId, tagId }).onConflictDoNothing();
      }
    }

    taskIds.push(taskId);
  }

  await db
    .update(scratchpads)
    .set({ extractedTaskIds: taskIds, updatedAt: new Date() })
    .where(eq(scratchpads.id, id));

  return { taskIds };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/unit/services/scratchpad.test.ts
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/services/scratchpad.ts tests/unit/services/scratchpad.test.ts
git commit -m "feat: scratchpad service — CRUD + process + commit"
```

---

## Task 17: Scratchpad routes

**Files:**
- Create: `app/api/scratchpad/route.ts`
- Create: `app/api/scratchpad/[id]/route.ts`
- Create: `app/api/scratchpad/[id]/process/route.ts`
- Create: `app/api/scratchpad/[id]/commit/route.ts`
- Create: `tests/integration/scratchpad.test.ts`

- [ ] **Step 1: Create `app/api/scratchpad/route.ts`**

```typescript
// app/api/scratchpad/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createScratchpad, listScratchpads } from '@/lib/services/scratchpad';

const CreateSchema = z.object({
  content: z.string().min(1),
  inputType: z.enum(['text', 'url', 'share', 'voice', 'file']).default('text'),
  title: z.string().optional(),
  inputPayload: z.record(z.unknown()).optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listScratchpads(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const pad = await createScratchpad(userId, parsed.data);
  return NextResponse.json(pad, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/scratchpad/[id]/route.ts`**

```typescript
// app/api/scratchpad/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getScratchpad, deleteScratchpad } from '@/lib/services/scratchpad';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const pad = await getScratchpad(userId, id);
  if (!pad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pad);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const deleted = await deleteScratchpad(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Create `app/api/scratchpad/[id]/process/route.ts`**

```typescript
// app/api/scratchpad/[id]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { processScratchpad } from '@/lib/services/scratchpad';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const pad = await processScratchpad(userId, id);
  if (!pad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pad);
}
```

- [ ] **Step 4: Create `app/api/scratchpad/[id]/commit/route.ts`**

```typescript
// app/api/scratchpad/[id]/commit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { commitScratchpad } from '@/lib/services/scratchpad';
import { enqueueJob } from '@/lib/services/jobs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { taskIds } = await commitScratchpad(userId, id);

  // Enqueue placement for each task
  await Promise.all(
    taskIds.map((taskId) =>
      enqueueJob('schedule:single-task', {
        userId,
        payload: { taskId },
        idempotencyKey: `schedule:single-task:${taskId}`,
      }),
    ),
  );

  // Self-trigger drain (fire-and-forget)
  fetch(
    new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
    { method: 'POST' },
  ).catch(() => {});

  return NextResponse.json({ taskIds });
}
```

- [ ] **Step 5: Write integration test**

```typescript
// tests/integration/scratchpad.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u1' }),
}));
vi.mock('@/lib/services/scratchpad', () => ({
  createScratchpad: vi.fn().mockResolvedValue({ id: 'sp1', content: 'hello', inputType: 'text', processed: false, userId: 'u1' }),
  listScratchpads: vi.fn().mockResolvedValue([]),
  getScratchpad: vi.fn().mockResolvedValue({ id: 'sp1', content: 'hello', inputType: 'text', processed: true, parseResult: { tasks: [{ title: 'Do thing', priority: 3, tags: [] }] }, userId: 'u1' }),
  processScratchpad: vi.fn().mockResolvedValue({ id: 'sp1', processed: true }),
  commitScratchpad: vi.fn().mockResolvedValue({ taskIds: ['t1', 't2'] }),
  deleteScratchpad: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/services/jobs', () => ({ enqueueJob: vi.fn().mockResolvedValue(null) }));
global.fetch = vi.fn().mockResolvedValue({});

import { GET, POST } from '@/app/api/scratchpad/route';
import { POST as processPost } from '@/app/api/scratchpad/[id]/process/route';
import { POST as commitPost } from '@/app/api/scratchpad/[id]/commit/route';
import { NextRequest } from 'next/server';

describe('GET /api/scratchpad', () => {
  it('returns empty array', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /api/scratchpad', () => {
  it('creates a scratchpad entry', async () => {
    const req = new NextRequest('http://localhost/api/scratchpad', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello', inputType: 'text' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('sp1');
  });
});

describe('POST /api/scratchpad/:id/process', () => {
  it('returns processed scratchpad', async () => {
    const req = new NextRequest('http://localhost/api/scratchpad/sp1/process', { method: 'POST' });
    const res = await processPost(req, { params: Promise.resolve({ id: 'sp1' }) });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/scratchpad/:id/commit', () => {
  it('returns created task IDs', async () => {
    const req = new NextRequest('http://localhost/api/scratchpad/sp1/commit', { method: 'POST' });
    const res = await commitPost(req, { params: Promise.resolve({ id: 'sp1' }) });
    const body = await res.json();
    expect(body.taskIds).toEqual(['t1', 't2']);
  });

  it('self-triggers drain after commit', async () => {
    const req = new NextRequest('http://localhost/api/scratchpad/sp1/commit', { method: 'POST' });
    await commitPost(req, { params: Promise.resolve({ id: 'sp1' }) });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/cron/drain'), expect.any(Object));
  });
});
```

- [ ] **Step 6: Run to confirm pass**

```bash
pnpm test tests/integration/scratchpad.test.ts
```

Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add app/api/scratchpad/ tests/integration/scratchpad.test.ts
git commit -m "feat: scratchpad routes — list, create, get, delete, process, commit"
```

---

## Task 18: Plugin routes

**Files:**
- Create: `app/api/plugins/route.ts`
- Create: `app/api/plugins/[name]/route.ts`
- Create: `tests/integration/plugins.test.ts`

- [ ] **Step 1: Create `app/api/plugins/route.ts`**

```typescript
// app/api/plugins/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listPlugins, getPluginWithConfig } from '@/lib/plugins/host';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const plugins = listPlugins();
  const withConfigs = await Promise.all(plugins.map((p) => getPluginWithConfig(userId, p.name)));
  return NextResponse.json(withConfigs.filter(Boolean));
}
```

- [ ] **Step 2: Create `app/api/plugins/[name]/route.ts`**

```typescript
// app/api/plugins/[name]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { getPluginWithConfig } from '@/lib/plugins/host';
import { db } from '@/lib/db/client';
import { scratchpadPluginConfigs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

type Params = { params: Promise<{ name: string }> };

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  rulesets: z.array(z.record(z.unknown())).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { name } = await params;

  const plugin = await getPluginWithConfig(userId, name);
  if (!plugin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(plugin);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { name } = await params;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Upsert config row
  const [existing] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(and(eq(scratchpadPluginConfigs.userId, userId), eq(scratchpadPluginConfigs.pluginName, name)));

  if (existing) {
    await db
      .update(scratchpadPluginConfigs)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(scratchpadPluginConfigs.id, existing.id));
  } else {
    await db.insert(scratchpadPluginConfigs).values({
      id: newId(), userId, pluginName: name, ...parsed.data,
    });
  }

  return NextResponse.json(await getPluginWithConfig(userId, name));
}
```

- [ ] **Step 3: Write integration test**

```typescript
// tests/integration/plugins.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth/helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u1' }),
}));
vi.mock('@/lib/plugins/host', () => ({
  listPlugins: vi.fn().mockReturnValue([{ name: 'text-to-tasks', version: '1.0.0', displayName: 'Text to Tasks', description: '', author: 'Kairos' }]),
  getPluginWithConfig: vi.fn().mockResolvedValue({ name: 'text-to-tasks', version: '1.0.0', displayName: 'Text to Tasks', enabled: true, config: {}, rulesets: [] }),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
}));

import { GET } from '@/app/api/plugins/route';
import { GET as getOne, PATCH } from '@/app/api/plugins/[name]/route';
import { NextRequest } from 'next/server';

describe('GET /api/plugins', () => {
  it('returns plugin list with config', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('text-to-tasks');
  });
});

describe('GET /api/plugins/:name', () => {
  it('returns plugin detail', async () => {
    const req = new NextRequest('http://localhost/api/plugins/text-to-tasks');
    const res = await getOne(req, { params: Promise.resolve({ name: 'text-to-tasks' }) });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/plugins/:name', () => {
  it('updates enabled flag', async () => {
    const req = new NextRequest('http://localhost/api/plugins/text-to-tasks', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ name: 'text-to-tasks' }) });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/integration/plugins.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add app/api/plugins/ tests/integration/plugins.test.ts
git commit -m "feat: plugin routes — list, get, patch config"
```

---

## Task 19: Full test run + TODO tick-off

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Tick off Phase 2 backend items in `TODO.md`**

Mark complete:
- `lib/gcal/` — auth.ts, calendars.ts, freebusy.ts, events.ts, errors.ts
- `lib/plugins/` — host.ts, types.ts, context.ts
- `lib/plugins/builtin/text-to-tasks/` — bundled plugin
- `lib/llm/` — Vercel AI SDK abstraction
- `app/api/schedule/run/route.ts`
- `app/api/cron/drain/route.ts`
- `app/api/scratchpad` routes
- `app/api/plugins` routes
- Schedule-on-write hook in tasks POST/PATCH

- [ ] **Step 4: Update CHANGELOG.md** with session log for this session.

- [ ] **Step 5: Final commit**

```bash
git add TODO.md CHANGELOG.md
git commit -m "docs: tick off Phase 2 backend items, update CHANGELOG"
```

---

## Self-review

**Spec coverage:**
- ✅ `lib/gcal/` — all 5 modules + adapter
- ✅ `lib/plugins/` — types, context, host
- ✅ `lib/plugins/builtin/text-to-tasks/` — full plugin
- ✅ `lib/llm/` — complete + completeStructured
- ✅ `app/api/schedule/run` — manual full-run trigger
- ✅ `app/api/cron/drain` — processes both job types
- ✅ `app/api/scratchpad` — all 6 operations
- ✅ `app/api/plugins` — list + get + patch
- ✅ Schedule-on-write hook in tasks handlers
- ✅ Scratchpad commit self-triggers drain (memory ADR)
- ✅ No `Project` / `projectId` anywhere
- ✅ No direct LLM provider imports outside `lib/llm/`

**Placeholder scan:** None found — every step has concrete code.

**Type consistency:** `GCalAdapter` interface from `runner.ts` used verbatim in `adapter.ts`. `PluginContext` defined once in `types.ts`, used in `context.ts` and plugin. `ScratchpadInput` flows from route → service → host → plugin without mutation.
