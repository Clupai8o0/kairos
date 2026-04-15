# Migration from the Old Build

The old build (`kairos-api` Python + `kairos-app` Next.js) is being **rebuilt from spec**, not ported. This file is the playbook for what that means in practice.

## TL;DR

- **Code:** not ported. Rebuilt fresh in TypeScript from the spec docs.
- **Data:** not migrated. Clean slate. There are no real users.
- **Old repos:** archived on GitHub (read-only), kept for reference only.
- **Reference docs:** the algorithmic / behavioural ones carry forward; the language-specific ones don't.

---

## What "rebuilt from spec" means

Don't open `kairos-api/services/scheduler.py` and translate it line-by-line into TypeScript. The result will be TypeScript that thinks it's Python — wrong patterns, wrong abstractions, wrong idioms, wrong test ergonomics.

Instead:

1. **Read the spec docs first** — `references/scheduling-engine.md`, `references/gcal-integration.md`, `references/data-model.md`. These describe *what* the system does and *why*.
2. **Read the test cases** — `references/testing.md` lists ~100 named cases that describe expected behaviour. These are the contract.
3. **Write TypeScript fresh** — using TypeScript idioms (Zod schemas, Drizzle queries, async/await with `Promise.all`, discriminated unions, `Result` types where appropriate).
4. **Consult the old Python only when stuck** — when the spec is unclear about an edge case, read the relevant Python file to see what the original did, understand it, then write the TypeScript version from that understanding. Read, close, write — never read and translate.

---

## The old build's failure modes — concrete numbers

These are the line counts that prove why the rewrite exists:

```
1051 lines  kairos/services/gcal_service.py     ← becomes lib/gcal/* (5 files)
 973 lines  kairos/services/scheduler.py        ← becomes lib/scheduler/* (7 files)
 543 lines  kairos/api/schedule.py              ← thin route handler now
 388 lines  kairos/services/task_service.py     ← becomes lib/services/tasks.ts, ~150 lines
 235 lines  kairos/services/scratchpad_service.py ← becomes plugin host + bundled plugin
 183 lines  kairos/services/project_service.py  ← DELETED — no Project concept
 141 lines  kairos/api/projects.py              ← DELETED
 106 lines  kairos/services/chat_service.py     ← DELETED — chat is post-v1
 104 lines  kairos/api/chat.py                  ← DELETED
```

The new code targets ~250 lines max per service file, ~80 lines max per route handler.

---

## What carries forward (reference docs)

Copy these from `kairos-api/references/` into this repo's `references/` folder, with a banner at the top of each:

> **Reference from the original Python build. Implementation language is now TypeScript. The decisions, algorithms, and behaviour described here still apply; code examples do not.**

| Old file | Action |
|---|---|
| `architecture-decisions.md` | **Don't copy** — superseded by this repo's `architecture-decisions.md` |
| `scheduling-engine.md` | **Copy with banner.** Algorithm and behaviour spec, language-independent. |
| `gcal-integration.md` | **Copy with banner.** OAuth scopes, free/busy quirks, all-day handling, timezone normalisation, rate limit behaviour. All identical in TypeScript. |
| `data-model.md` | **Copy with banner**, then use as input to write the new Drizzle schema. The reasoning for each field carries forward. |
| `api-contract.md` | **Copy with banner**, then use as input to design Route Handlers. Most endpoints survive (minus projects, minus chat). |
| `testing.md` | **Copy with banner.** ~100 test cases. Translate names + assertions to Vitest, but keep the case structure and edge cases. |
| `project-structure.md` | **Don't copy** — replaced by this repo's `project-structure.md`. |
| `frontend-handover-schedule-views.md` | **Copy if useful.** The old frontend's schedule view design notes. |

---

## What gets deleted (do not port)

| Old file | Why |
|---|---|
| `kairos/models/project.py` | ADR-R7 — no Project entity |
| `kairos/services/project_service.py` | ADR-R7 |
| `kairos/api/projects.py` | ADR-R7 |
| `kairos/schemas/project.py` | ADR-R7 |
| `kairos/models/chat_session.py` | ADR-R8 — chat is post-v1 |
| `kairos/services/chat_service.py` | ADR-R8 |
| `kairos/api/chat.py` | ADR-R8 |
| `kairos/schemas/chat.py` | ADR-R8 |
| `tests/test_projects.py` | follows from ADR-R7 |
| `tests/test_projects_bearer_auth.py` | follows from ADR-R7 |
| `tests/test_chat.py` | follows from ADR-R8 |
| All Pydantic schemas | replaced by Zod |
| All Alembic migrations | replaced by drizzle-kit migrations against fresh schema |
| `services/scratchpad_service.py`'s LLM call | moved into `lib/plugins/builtin/text-to-tasks/` |
| Frontend `app/(app)/chat/`, `components/voice/`, `lib/stores/voice-store.ts`, `lib/hooks/use-voice.ts` | ADR-R6 — voice and chat not in v1 |

---

## What gets rebuilt fresh (with reference)

The conceptual model survives; the implementation is new.

### Models — Drizzle schema in `lib/db/schema/*.ts`
Use the old `data-model.md` as the spec. Write Drizzle table definitions fresh. Notable changes:
- Remove `projectId` from `tasks`
- Add `source`, `sourceRef`, `sourceMetadata` to `tasks`
- Replace `scratchpads.extractedTasks` (fixed JSONB shape) with `scratchpads.parseResult` (plugin-shaped) plus `inputType`, `inputPayload`, `pluginName`, `pluginVersion`, `extractedTaskIds`
- Add `scratchpadPluginConfigs`, `pluginInstalls`, `jobs` tables
- camelCase TypeScript identifiers; snake_case Postgres columns via Drizzle's column name option

### Scheduler — `lib/scheduler/*.ts`
Use the old `scheduling-engine.md` as the spec. Categorise each function from the old `scheduler.py` by concern, and write the TypeScript module for that concern fresh:

| Concern | New home |
|---|---|
| "which tasks need scheduling now" | `lib/scheduler/candidates.ts` |
| Urgency / priority scoring (pure) | `lib/scheduler/urgency.ts` |
| Free slot computation from busy intervals | `lib/scheduler/slots.ts` |
| Choosing which slot a task goes into | `lib/scheduler/placement.ts` |
| Splitting long tasks into chunks | `lib/scheduler/splitting.ts` |
| Generating recurrence occurrences | `lib/scheduler/recurrence.ts` |
| Anything that touches the DB or GCal | `lib/scheduler/runner.ts` |

Rule: pure modules take plain data in and return plain data out. `runner.ts` is the only place with side effects.

### GCal — `lib/gcal/*.ts`
Use the old `gcal-integration.md` as the spec. Same split:

| Concern | New home |
|---|---|
| OAuth + token refresh | `lib/gcal/auth.ts` |
| List connected calendars | `lib/gcal/calendars.ts` |
| Free/busy queries | `lib/gcal/freebusy.ts` |
| Event CRUD | `lib/gcal/events.ts` |
| Error mapping (GoogleApi → domain errors) | `lib/gcal/errors.ts` |

Use `googleapis` (the official Node SDK) — different ergonomics than `google-api-python-client` but the same underlying API behaviour.

### Scratchpad — `lib/services/scratchpad.ts` + `lib/plugins/`
The old `scratchpad_service.py` had hardcoded LLM logic. Don't port that. Build the plugin host (`lib/plugins/host.ts`, `types.ts`, `context.ts`) per `references/plugin-system.md`, and put the LLM logic inside `lib/plugins/builtin/text-to-tasks/`.

### Tests — `tests/`
Translate from `references/testing.md` into Vitest. Keep the case names. Pure-function tests go in `tests/unit/`. Route handler tests go in `tests/integration/` using `msw` for HTTP mocking.

---

## Order of operations (first three Claude Code sessions)

1. **Skeleton + auth + DB + first model**
   - `create-next-app` baseline
   - Better Auth + Google OAuth wired up (one flow grants both app login and GCal scopes)
   - Neon connected via `@neondatabase/serverless`
   - Drizzle schema for `users`, `tasks`, `tags`, `taskTags` plus Better Auth tables
   - Initial migration applied
   - Smoke-test route handler at `/api/health`

2. **Tasks + tags + views CRUD**
   - Route Handlers, services, integration tests via Vitest + msw
   - Get to "I can POST a task and GET it back, with tags"
   - ESLint custom rule banning `Project`/`projectId` in place
   - ESLint custom rule banning direct LLM provider imports outside `lib/llm/` and `lib/plugins/builtin/` in place

3. **Scheduler pipeline (pure functions only)**
   - `lib/scheduler/urgency.ts`, `lib/scheduler/slots.ts`, `lib/scheduler/placement.ts` as pure functions with unit tests
   - **No DB, no GCal yet**
   - Translate the relevant test cases from old `testing.md`

After those three, the rewrite has a working foundation. GCal integration, plugin host, and the bundled `text-to-tasks` plugin come in sessions 4–7.

---

## What to do with the old repos

1. **Archive `kairos-api` and `kairos-app` on GitHub** (Settings → Archive). They become read-only, can't be pushed to, but stay accessible for reference.
2. **Stop running them locally.** Don't keep two backends alive. The old one isn't getting fixes.
3. **Don't delete the repos.** They cost nothing on GitHub, and the codebases are useful as reference when a spec is unclear.
4. **Don't open them in your editor while writing new code.** Read in a browser if needed. Read, close, write.
