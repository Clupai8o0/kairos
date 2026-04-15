# Scheduling Engine

Reference doc for `lib/scheduler/`. Read this before touching any scheduler file.

---

## Pipeline structure (ADR-R1)

```
lib/scheduler/
├── types.ts         # shared types across pipeline modules
├── urgency.ts       # pure scoring — priority × deadline proximity
├── candidates.ts    # filter + rank tasks that need scheduling
├── slots.ts         # compute free slots from windows, blackouts, busy intervals
├── placement.ts     # assign a single task to a slot (first-fit, buffers respected)
├── splitting.ts     # split a long splittable task across multiple slots
├── recurrence.ts    # expand a recurrenceRule into concrete occurrence dates
└── runner.ts        # orchestrator — ONLY file that reads DB + calls GCal
```

Everything except `runner.ts` is pure: no DB, no HTTP, no side effects. All pure modules are unit-testable with plain data objects.

---

## Key types

```typescript
// A computed free time slot
type TimeSlot = { start: Date; end: Date };

// A busy interval from GCal free/busy API
type BusyInterval = { start: Date; end: Date };

// A schedule window row from the DB
type ScheduleWindow = {
  dayOfWeek: number;   // 0=Sunday..6=Saturday
  startTime: string;   // 'HH:MM' 24h
  endTime: string;     // 'HH:MM' 24h
};

// Task augmented with urgency score
type ScoredTask = Task & { urgency: number };

// A resolved placement for one task (or one chunk of a split task)
type PlacedChunk = {
  start: Date;
  end: Date;
  chunkIndex: number;  // 0 for non-split tasks
};
```

---

## Urgency scoring (`urgency.ts`)

`scoreUrgency(task, now)` → `number`

Higher score = schedule sooner.

```
base = 5 - priority          // priority 1→4.0, 4→1.0
if deadline is null: return base
if deadline is past: return base + 10
if deadline < durationMins away: return base + 8
deadline_boost = 5 / max(hoursLeft / 24, 0.1)   // ~5 at 1 day, ~0.5 at 10 days
return base + min(deadline_boost, 8)
```

---

## Candidate selection (`candidates.ts`)

`selectCandidates(tasks, doneTaskIds, now)` → `ScoredTask[]`

Filters tasks to those that are ready to schedule, sorted urgency-descending:

1. `schedulable === true`
2. `status` is `'pending'` or `'scheduled'` (re-placement allowed)
3. All `dependsOn` IDs are present in `doneTaskIds`
4. Scored via `urgency.ts`, sorted descending

`doneTaskIds` should contain the IDs of all tasks whose status is `'done'` or `'scheduled'` (the caller builds this set from the full task list before calling).

---

## Free slot computation (`slots.ts`)

`computeFreeSlots(windows, blackoutDates, busy, from, to)` → `TimeSlot[]`

Algorithm:
1. Walk day-by-day from `from` to `to`
2. Skip any day whose date string is in `blackoutDates`
3. For each matching `ScheduleWindow` on that `dayOfWeek`, generate `[windowStart, windowEnd]`
4. Subtract all `BusyInterval`s that overlap the window
5. Collect resulting free fragments

`subtractBusy(slot, busy)` is the core interval-subtraction routine (internal).

`consumeSlot(slots, used)` → `TimeSlot[]` removes a used range from the slot list (used by `runner.ts` when placing multiple tasks in sequence).

---

## Placement (`placement.ts`)

`placeTask(task, slots)` → `PlacedChunk | null`

First-fit: finds the first slot with at least `durationMins + bufferMins` of room. Returns:
- `start`: slot start
- `end`: `start + durationMins` (bufferMins is not part of the GCal event)
- `chunkIndex: 0`

Returns `null` if no suitable slot exists.

---

## Splitting (`splitting.ts`)

`splitTask(task, slots)` → `PlacedChunk[] | null`

Only applies when `task.isSplittable === true`. Caller should always try `placeTask` first.

Greedy algorithm:
1. `remaining = durationMins * 60 * 1000` (ms)
2. For each slot, if slot duration ≥ `minChunkMins`, allocate `min(slotDuration, remaining)`
3. If all `remaining` is allocated, return chunks
4. Otherwise return `null` (not enough space even split)

---

## Recurrence expansion (`recurrence.ts`)

`generateOccurrences(rule, anchor, from, to)` → `Date[]`

Supported rule shape:
```typescript
type RecurrenceRule = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;       // default 1
  byDayOfWeek?: number[];  // 0=Sun..6=Sat — for weekly with specific days
  byDayOfMonth?: number;   // for monthly (1..31)
  until?: string;          // ISO date string (inclusive)
  count?: number;          // max occurrences (hard cap: 366)
};
```

`anchor` is the first occurrence's timestamp (time-of-day is preserved in all occurrences).

---

## Runner (`runner.ts`)

`scheduleSingleTask(userId, taskId, gcal?)` → `PlacedChunk | null`

1. Load task + user schedule windows + blackout days from DB
2. Determine date range to search (now → now+14 days)
3. Get busy intervals from GCal (via `gcal.getFreeBusy`) — empty if `gcal` not provided
4. Compute free slots → try `placeTask` → fall back to `splitTask` if splittable
5. If placed: update `task.scheduledAt`, `task.scheduledEnd`, `task.status='scheduled'`, optionally `task.gcalEventId`
6. Write a `scheduleLogs` row
7. Return placed chunk or `null`

`scheduleFullRunChunk(userId, chunk, gcal?)` → `{ scheduled: string[]; remaining: number }`

Drains up to N candidates per invocation (N=20). Called by the cron drain job in batches.

The `gcal` parameter accepts a `GCalAdapter` interface; when omitted, GCal calls are skipped. This lets the scheduler run (and be tested) before `lib/gcal/` is built.

---

## Invariants

- Pure modules have zero imports from `@/lib/db/*` or `googleapis`
- `runner.ts` never does business logic — it only orchestrates calls to pure modules + DB + GCal adapter
- A task with `schedulable=false` is never a candidate
- Buffer is consumed from the slot but not included in the GCal event duration
- `splitTask` is only called if `placeTask` returns `null` AND `task.isSplittable === true`

---

## What this session builds

All pure modules + unit tests. `runner.ts` is written with GCal calls stubbed via the `GCalAdapter` interface. `lib/gcal/` is built next session; wiring it into `runner.ts` is a one-line change per stub.
