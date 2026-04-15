# 03 — Data Model

The slimmed-down entity set for the rewrite, expressed as Drizzle schema. Decisions about *which* fields exist and *why* are language-independent — the shape carries forward from the old build's `data-model.md`. The expression is now TypeScript.

## Entities (rewrite v1)
- `users`
- `tasks`
- `tags` (+ `taskTags` join table)
- `views` (saved filters)
- `blackoutDays`
- `scheduleLogs`
- `scheduleWindows`
- `jobs` (background work — see ADR-R9)
- `googleAccounts`
- `googleCalendars`
- `scratchpads`
- `scratchpadPluginConfigs` *(per-user per-plugin config + memory + rulesets)*
- `pluginInstalls` *(installed plugins, version, enabled flag)*
- Better Auth tables: `sessions`, `accounts`, `verificationTokens` (managed by Better Auth's Drizzle adapter)

## Entities removed from the old build
- ❌ `projects` — replaced by tags
- ❌ `chatSessions` — chat is post-v1

## Schema overview (Drizzle)

Note: actual Drizzle schema goes in `db/schema/*.ts`. This is the conceptual shape, not the verbatim code. Field naming uses camelCase in TypeScript; column naming in Postgres is snake_case via Drizzle's column name option.

### tasks
```typescript
{
  id: text (cuid, primary key)
  userId: text (FK -> users.id)
  // NOTE: no projectId

  // Core
  title: text
  description: text | null
  durationMins: integer | null

  // Scheduling inputs
  deadline: timestamp | null
  priority: integer (1=urgent .. 4=low)
  status: text ('pending' | 'scheduled' | 'in_progress' | 'done' | 'cancelled')
  schedulable: boolean (default true)

  // GCal reference (the only time-related fields)
  gcalEventId: text | null
  scheduledAt: timestamp | null
  scheduledEnd: timestamp | null

  // Flexibility
  bufferMins: integer (default 15)
  minChunkMins: integer | null
  isSplittable: boolean (default false)

  // Dependencies
  dependsOn: text[] (task ids)

  // Recurrence
  recurrenceRule: jsonb | null
  parentTaskId: text | null
  recurrenceIndex: integer | null

  // Provenance
  source: text | null  // 'manual' | 'scratchpad:builtin-text' | 'scratchpad:instagram-plugin' | etc.
  sourceRef: text | null  // plugin-specific reference (e.g. instagram reel id)
  sourceMetadata: jsonb (default '{}')

  // Bookkeeping
  completedAt: timestamp | null
  metadata: jsonb (default '{}')
  createdAt: timestamp (default now)
  updatedAt: timestamp (default now)
}
```

Key changes from the old `tasks` table:
- `projectId` removed
- `source`, `sourceRef`, `sourceMetadata` added — every task knows where it came from
- camelCase TypeScript identifiers; snake_case Postgres columns

### tags + taskTags
```typescript
tags {
  id: text (cuid)
  userId: text (FK)
  name: text
  color: text | null
  createdAt: timestamp
  updatedAt: timestamp
}

taskTags {
  taskId: text (FK -> tasks.id)
  tagId: text (FK -> tags.id)
  // composite primary key (taskId, tagId)
}
```
Unique constraint on `(userId, name)` for tags.

### scratchpads
```typescript
{
  id: text (cuid)
  userId: text (FK)

  // Raw input
  title: text | null
  content: text  // may be empty if input is e.g. a URL
  inputType: text  // 'text' | 'url' | 'share' | 'voice' | etc.
  inputPayload: jsonb (default '{}')  // plugin-specific (e.g. { url: '...' })

  // Routing
  pluginName: text | null  // which plugin handled it (null until processed)
  pluginVersion: text | null

  // Output
  processed: boolean (default false)
  parseResult: jsonb | null  // full plugin output
  extractedTaskIds: text[] (default '{}')

  createdAt: timestamp
  updatedAt: timestamp
}
```

Differences from old `scratchpads`:
- `extractedTasks` JSONB blob (fixed shape) replaced by `parseResult` (plugin-shaped)
- Adds `inputType`, `inputPayload`, `pluginName`, `pluginVersion`
- Tracks created task ids (`extractedTaskIds`) for traceability

### scratchpadPluginConfigs
```typescript
{
  id: text (cuid)
  userId: text (FK)
  pluginName: text

  enabled: boolean (default true)
  config: jsonb (default '{}')   // plugin's own config (api keys, defaults)
  memory: jsonb (default '{}')   // plugin-managed memory (learned preferences)
  rulesets: jsonb (default '[]') // user-defined rules

  createdAt: timestamp
  updatedAt: timestamp
}
```
Unique constraint on `(userId, pluginName)`.

### pluginInstalls
```typescript
{
  id: text (cuid)
  userId: text (FK)

  pluginName: text
  pluginVersion: text
  source: text  // 'builtin' | 'npm' | 'http' | 'git'
  sourceUrl: text | null

  enabled: boolean (default true)
  installedAt: timestamp
}
```

### jobs (new — see ADR-R9)
```typescript
{
  id: text (cuid)
  userId: text (FK) | null  // null for system jobs
  type: text  // 'schedule:single-task' | 'schedule:full-run-chunk' | 'gcal:sync' | etc.
  payload: jsonb
  status: text  // 'pending' | 'running' | 'done' | 'failed' | 'dead'
  runAfter: timestamp (default now)
  attempts: integer (default 0)
  maxAttempts: integer (default 3)
  lastError: text | null
  idempotencyKey: text | null  // unique if set, prevents duplicate enqueues
  createdAt: timestamp
  updatedAt: timestamp
}
```
Unique partial index on `idempotencyKey` where not null.

### googleAccounts, googleCalendars, blackoutDays, scheduleWindows, scheduleLogs, views
Carry forward from the old `data-model.md` with the same fields, translated to camelCase TypeScript identifiers and Drizzle column types.

## Why Drizzle and not Prisma

- **Lighter runtime.** Drizzle is just a query builder — no separate engine binary, no codegen step that runs in CI.
- **Closer to SQL.** When something goes wrong with a complex query (the scheduler does some), reading Drizzle code reads like reading SQL. Prisma's abstractions are nice until they aren't.
- **Better Vercel cold-start performance.** Drizzle has a smaller bundle and no extra binary download on first invocation.
- **Native Neon HTTP driver support.** Drizzle works cleanly with Neon's serverless driver, which is what you want on Vercel.
- **Better Auth's Drizzle adapter is first-class.** No second-class auth integration story.

## Migration from the old build

**Not applicable for v1.** The old build's data is development/test data. The plan is to start the new build with an empty database. If there are any old tasks worth preserving, they get exported as JSON manually.

The 8-step Postgres migration that lived in the old `migration-from-old-build.md` is dropped. See `04-phases.md` Phase 1 — clean slate.
