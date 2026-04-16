# CHANGELOG

Session memory for Kairos. Read this first every session. Update at session end without exception.

If a decision in this file conflicts with `references/architecture-decisions.md`, this file wins (it's newer). Promote permanent decisions back into ADRs at session end.

---

## Current State

**Phase:** 3 — Open source (in progress).

### Phase 2 complete — what's built
- [x] Full backend: scheduler pipeline, GCal layer, plugin host, scratchpad, jobs queue
- [x] Full frontend: all 7 app routes wired to real APIs via TanStack Query
- [x] Theme system: 2 built-in packs (obsidian-linear + morning-light), server-side `data-theme` injection (no FOUC), Cmd+K palette switcher, Settings→Appearance picker
- [x] `no-raw-colors` ESLint rule active — 0 errors, 2 pre-existing warnings (RHF/React Compiler, test unused var)
- [x] `useRunSchedule` hook + "Run schedule" button in schedule page header + command palette entry
- [x] `compileManifest` snapshot test + 16 theme unit+integration tests
- [x] All deprecated exports removed (`useToggleCalendar`)

### Active decisions (pending promotion to ADRs)
- Default pack defines tokens in Tailwind `@theme {}` block; additional packs override under `[data-theme="<id>"]` CSS selectors — no JS required for switching, pure CSS cascade
- Theme switch flow: `PATCH /api/me/theme` → page reload → server reads `activeThemeId` → injects `data-theme` on `<html>` before paint

### Known issues / blockers
- Lighthouse perf score not yet measured (needs live deploy)
- `vercel.json` cron still set to daily at midnight UTC (hobby plan; scratchpad commit self-triggers drain for immediacy)

### Phase 3 progress
- [x] MIT license
- [x] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue + PR templates
- [x] Vercel one-click deploy button in README
- [x] Docker self-host: `docker-compose.yml` + `Dockerfile` + `output: 'standalone'`
- [x] Landing page: hero, features, how-it-works, self-host section, footer (GSAP animations)
- [ ] Plugin SDK: `@kairos/plugin-sdk` npm package
- [ ] Docs at `app/(marketing)/docs/` (including theme-pack authoring guide)
- [ ] Public GitHub repo set to public
- [ ] `v1.0.0` release tag

### Next concrete action
**Phase 3 remaining** — Plugin SDK package + docs site structure. Then tag v1.0.0 once deployed to kairos.app.

---

## Session log

Append new entries at the top. Use the template below.

### Template

```
## YYYY-MM-DD — short title

**Goal for this session:** one sentence.

**Built:**
- bullet list of concrete things added/changed

**Decisions made:**
- bullet list — each one either references an existing ADR or proposes a new one

**Files touched:** count or list

**Tests added:** count

**Next action:**
- one concrete starting point for the next session
```

---

## Sessions

## 2026-04-16 — Session 9: Phase 3 open-source foundations — landing page, Docker, license, contribution docs

**Goal for this session:** Phase 3 open-source foundations — proper landing page, Docker self-host, MIT license, CONTRIBUTING.md, PR/issue templates.

**Built:**
- `app/(marketing)/page.tsx` — full landing page: sticky nav, hero with GSAP entrance animation, 6-feature grid, 3-step how-it-works, self-host callout with CLI snippet, footer; scroll-reveal on features/steps/callout via ScrollTrigger
- `docker-compose.yml` — self-host stack: Next.js app + Postgres 16 with health check, all env vars from `.env.example`
- `Dockerfile` — multi-stage (deps → builder → runner), Node 22 Alpine, standalone output
- `next.config.ts` — `output: 'standalone'` for Docker compatibility (Vercel ignores this)
- `LICENSE` — MIT, year 2026, Kairos Contributors
- `README.md` — proper public README: description, Vercel one-click deploy button, Docker setup, env var table, architecture overview
- `CONTRIBUTING.md` — prerequisites, local setup, Google OAuth setup, dev commands, architecture rules, PR process
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 adaptation
- `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md`
- `.github/pull_request_template.md`

**Decisions made:**
- MIT license (not Apache-2.0) — simpler, less friction for contributors
- `output: 'standalone'` always enabled in next.config.ts — Vercel ignores it, Docker uses it
- GitHub org/repo name assumed: `kairos-app/kairos`

**Files touched:** 10

**Tests added:** 0

**Next action:**
- Make GitHub repo public (set to public via GitHub settings)
- Phase 3 remaining: Plugin SDK (`@kairos/plugin-sdk`) + docs under `app/(marketing)/docs/`

---

## 2026-04-16 — Session 8: Phase 2 completion — raw-color fixes, schedule hook, command palette cleanup

**Goal for this session:** Close all remaining Phase 2 gaps: fix raw-color ESLint violations, wire schedule run, fix command-palette lint, clean up deprecated hooks, update tracking docs.

**Built:**
- Fixed all raw-color violations across component files (`tags/page.tsx`, `settings/page.tsx`, `settings/appearance/page.tsx`, `views/page.tsx`) — all hex literals and raw Tailwind utilities replaced with semantic tokens
- `lib/hooks/use-schedule.ts` — `useRunSchedule()` mutation for `POST /api/schedule/run`
- `app/(app)/schedule/page.tsx` — "Run schedule" button in header with `toast.promise`; removed unused `eventsLoading` variable
- `components/app/command-palette.tsx` — "Run full schedule" command; fixed lint: moved `setActiveIdx(0)` from `useEffect` into `onChange`; ternary expressions → `if` statements
- `app/(app)/views/page.tsx` — `deleteView.mutate()` → `deleteView.mutateAsync()` with `toast.promise`
- `lib/hooks/use-calendars.ts` — removed deprecated `useToggleCalendar` (unused; `useUpdateCalendar` covers the same functionality)
- `TODO.md` + `CHANGELOG.md` — ticked off all completed Phase 2 items; updated Current State to Phase 2 complete

**Decisions made:**
- No new ADRs; existing ADR-R1–R13 remain valid

**Files touched:** 9

**Tests added:** 0

**Next action:**
- Phase 3: open-source foundations — license, CONTRIBUTING.md, Vercel one-click deploy, Docker self-host verification, landing page content

---

## 2026-04-16 — Session 7: Phase 2 frontend — theme system UI

**Goal for this session:** Complete the Phase 2 frontend TODOs: CSS pack split, appearance page, command palette, layout data-theme injection.

**Built:**
- `app/styles/packs/obsidian-linear.css` — @theme block moved here; added missing required tokens (`--color-accent-hover`, `--color-line-subtle`, `--color-warning`, `--color-danger`, `--radius-*`)
- `app/styles/packs/morning-light.css` — second built-in pack (light theme), scoped under `[data-theme="morning-light"]`
- `app/styles/packs/manifest.ts` — static `BUILT_IN_PACKS` registry + `DEFAULT_PACK_ID`
- `app/globals.css` — now: `@import tailwindcss` + pack imports + semantic-var body/scrollbar resets; no raw hex
- `app/api/me/theme/route.ts` — `PATCH /api/me/theme` (validates against `BUILT_IN_PACKS`, updates `users.activeThemeId`)
- `lib/hooks/use-theme.ts` — `useSetTheme` mutation; reloads page on success for FOUC-free switch
- `app/(app)/settings/appearance/page.tsx` — pack picker with mini preview swatches per pack
- `app/(app)/settings/page.tsx` — Appearance section linking to /settings/appearance
- `components/app/command-palette.tsx` — Cmd+K palette: nav commands + `Theme: <n>` entries; live CSS-var preview on hover/arrow; reverts on escape
- `app/(app)/layout.tsx` — `CommandPalette` mounted in app shell
- `app/layout.tsx` — server-side `resolveUserTheme` → `data-theme` on `<html>` (no FOUC)
- `components/app/sidebar.tsx` — settings active state covers all `/settings/*`
- `drizzle/0002_active_theme.sql` (duplicate) — removed; `0002_rich_the_hand.sql` from parallel session is canonical
- `tests/unit/themes/types.test.ts` — fixed TS error: `VALID` typed as `ThemeManifest` not `Parameters<...>[0]`

**Decisions made:**
- Default pack (`obsidian-linear`) defines tokens in `@theme {}` (Tailwind-native); additional packs override the same CSS custom properties under `[data-theme="<id>"]` — no JS needed for theme switch, pure CSS cascade
- On theme switch: `useSetTheme` → `PATCH /api/me/theme` → page reload — `data-theme` is set server-side, zero FOUC
- Command palette live preview: temporarily sets `document.documentElement.dataset.theme`, stores original in `data-theme-original`, reverts on escape/close

**Files touched:** 13

**Tests:** 157 passing (1 TS error fixed in existing test)

**Phase 2 DoD — theme items now complete:**
- [x] At least 2 built-in packs
- [x] Pack switcher via Settings→Appearance and Cmd+K palette
- [x] Choice persists across sessions (DB)
- [x] No FOUC on switch (server-side injection)
- [x] `no-raw-colors` ESLint rule active
- [x] `compileManifest` snapshot test passing

**Next action:**
- Run `pnpm db:migrate` to apply `0002_rich_the_hand.sql` to the live DB
- Verify on Vercel preview deploy

---

## 2026-04-16 — Session 6: Phase 2 backend — theme system

**Goal for this session:** Complete the remaining Phase 2 backend items: theme lib, ESLint rule, migration, route, tests.

**Built:**
- `lib/themes/types.ts` — `ThemeManifestSchema` + `ThemeManifest` type (Zod v4; required 20-token contract + catchall for optional tokens)
- `lib/themes/compile.ts` — pure `compileManifest()` (manifest → CSS string, no IO)
- `lib/themes/runtime.ts` — `resolveUserTheme()` (DB lookup → built-in or marketplace reference; phase 4 adds marketplace path)
- `lib/db/schema/auth.ts` — `activeThemeId` column added to `user` table (default: `'obsidian-linear'`)
- `drizzle/0002_rich_the_hand.sql` — migration: `ALTER TABLE "user" ADD COLUMN "active_theme_id" text DEFAULT 'obsidian-linear' NOT NULL`
- `eslint-rules/no-raw-colors.js` — bans raw Tailwind colour utilities, hex literals, and colour functions in component files; `app/styles/packs/` and `lib/themes/compiled/` are exempt
- `eslint.config.mjs` — wired `no-raw-colors` rule as `'error'`
- `tests/unit/themes/compile.test.ts` — 4 tests (snapshot + font imports + no-import path)
- `tests/unit/themes/types.test.ts` — 8 tests (valid, missing required token, bad color, bad version, bad id, extra optional tokens)
- `tests/integration/me-theme.test.ts` — 4 tests (known pack, default pack, unknown pack 400, missing themeId 400)
- Fixed pre-existing `tests/integration/calendars.test.ts` failure: mock was missing `updateCalendar` after service was refactored

**Decisions made:**
- `lib/themes/runtime.ts` phase-2 only returns `{ kind: 'builtin' }` — phase 4 will add `themeInstalls` lookup
- Theme pack validation in `PATCH /api/me/theme` is against `BUILT_IN_PACKS` registry (not just regex) to prevent setting unknown pack ids

**Files touched:** 11 created/modified

**Tests added:** 16 (all 157 tests pass)

**Next action:**
- Phase 2 frontend completion: settings/appearance page, command palette theme switcher, layout injects `data-theme` from `resolveUserTheme`

---

## 2026-04-16 — Session 4: Phase 2 backend

**Goal for this session:** Build the full Phase 2 backend — GCal layer, LLM abstraction, plugin system, job queue, scratchpad, and related routes.

**Built:**
- `lib/gcal/` — errors.ts, auth.ts, freebusy.ts, events.ts, calendars.ts, adapter.ts
- `lib/llm/index.ts` — complete() + completeStructured() via Vercel AI SDK (openai/anthropic/ollama)
- `lib/plugins/types.ts`, `context.ts`, `host.ts` — plugin system
- `lib/plugins/builtin/text-to-tasks/` — bundled text extraction plugin with ruleset support
- `lib/services/jobs.ts` — enqueueJob, claimPendingJobs, markJobDone/Failed
- `lib/services/scratchpad.ts` — CRUD + process + commit
- `app/api/cron/drain/route.ts` — Vercel Cron drain (GET + POST)
- `app/api/schedule/run/route.ts` — manual full-run trigger
- `app/api/scratchpad/` — list, create, get, delete, process, commit routes
- `app/api/plugins/` — list, get, patch routes
- `app/api/calendars/sync/route.ts` — GCal calendar list sync
- Schedule-on-write hook in task create/update handlers
- Removed `@better-auth/infra` (was unused)
- Fixed Zod v4 compatibility in plugin types (z.record requires explicit key type)

**Decisions made:**
- Vercel hobby plan daily cron: scratchpad commit self-triggers drain (fire-and-forget POST to /api/cron/drain) so batch-created tasks are scheduled immediately
- GCalAdapter injected into runner.ts — no circular dep, fully testable without GCal mock

**Files touched:** ~35 files created/modified

**Tests added:** ~25

**Next action:**
- Session 5: Phase 2 frontend — dashboard, tasks, schedule, scratchpad, tags, views, settings routes under app/(app)/

---

## 2026-04-16 — Session 5: Frontend wired to Phase 2 backend + lint cleanup

**Goal for this session:** Connect frontend to the real Phase 2 backend; achieve Phase 2 definition of done.

**Built:**
- `lib/hooks/types.ts` — added `Scratchpad`, `CandidateTask`, `Plugin` types
- `lib/hooks/use-scratchpad.ts` — `useScratchpads`, `useCreateScratchpad`, `useProcessScratchpad`, `useCommitScratchpad`, `useDeleteScratchpad`
- `lib/hooks/use-plugins.ts` — `usePlugins`, `useTogglePlugin`
- `app/(app)/scratchpad/page.tsx` — full 4-step flow: text input → create scratchpad entry → process (plugin dispatch) → preview candidates → commit to tasks; past scratchpad list; warnings display; graceful error states
- `app/(app)/settings/page.tsx` — added Plugins section (enable/disable toggle per plugin), improved LLM provider section with env var reference grid
- `tests/unit/plugins/host.test.ts` — fixed Vitest 4 type error (`vi.mocked()` instead of manual cast)
- `lib/plugins/context.ts` — removed unused `CompletionOptions` import + parameter, dropped unused `_options` param
- `tests/unit/services/jobs.test.ts` — removed unused `markJobFailed` import

**Decisions made:**
- Scratchpad flow is: POST /scratchpad → POST /scratchpad/:id/process → POST /scratchpad/:id/commit (three separate round-trips, each can fail independently with a friendly error state)
- LLM provider config is server-side env vars only — no per-user API key storage in v1; settings page shows the env var reference

**Files touched:** 8 files

**Tests added:** 0 (existing 140 tests pass)

**Phase 2 frontend DoD met:**
- [x] User can paste text → extract tasks → preview → commit → auto-scheduled
- [x] User can disable bundled plugin in Settings → scratchpad won't process
- [x] All frontend code uses TanStack Query, no raw fetch in components
- [ ] Lighthouse perf > 90 (needs live deploy to measure)

**Next action:**
- Commit all changes, then verify on the live Vercel preview deploy.

---

## 2026-04-16 — Session 4 (parallel): Frontend — design system + all app routes

**Goal for this session:** Build the full Phase 2 frontend — design tokens, app shell, all 7 page routes, TanStack Query hooks, and landing page.

**Built:**
- `app/globals.css` — Linear-inspired design system: `@theme` semantic tokens (`canvas`, `surface`, `surface-2/3`, `fg/fg-2/3/4`, `brand`, `accent/2`, `success`, `emerald`, `line/2`, `ghost/2/3`, `wire/2`), Inter Variable font, dark scrollbar, selection highlight
- `app/layout.tsx` — Inter Variable font via `next/font/google` with `--font-inter` CSS variable
- `lib/auth/client.ts` — Better Auth React client (`createAuthClient`)
- `lib/hooks/types.ts` — Client-safe interfaces: `Tag`, `Task`, `TaskStatus`, `View`, `GoogleCalendar`
- `lib/hooks/use-tasks.ts` — TanStack Query: `useTasks`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`
- `lib/hooks/use-tags.ts` — TanStack Query: `useTags`, `useCreateTag`, `useUpdateTag`, `useDeleteTag`
- `lib/hooks/use-views.ts` — TanStack Query: `useViews`, `useCreateView`, `useUpdateView`, `useDeleteView`
- `lib/hooks/use-calendars.ts` — TanStack Query: `useCalendars`, `useToggleCalendar`
- `components/app/sidebar.tsx` — Left nav with icons (Dashboard, Tasks, Schedule, Scratchpad, Tags, Views, Settings), active state, user session display + sign-out
- `app/(app)/layout.tsx` — Full app shell: auth guard + sidebar + content area
- `app/(app)/dashboard/page.tsx` — Stats grid (pending/in-progress/scheduled/done), upcoming deadlines list, tags summary
- `app/(app)/tasks/page.tsx` — Full task CRUD: filter tabs by status, task cards with status toggle/edit/delete, Framer Motion animated list, TaskModal with react-hook-form + Zod (title, description, priority, deadline, schedulable, duration, tag multi-select)
- `app/(app)/tags/page.tsx` — Tag CRUD: inline create/edit forms with color picker (10 presets)
- `app/(app)/views/page.tsx` — View CRUD: named views with inline create
- `app/(app)/schedule/page.tsx` — Scheduled task list (sorted by scheduledAt), empty state with context
- `app/(app)/scratchpad/page.tsx` — Text input + Extract Tasks button wired to `/api/scratchpad/process` (404 handled gracefully until backend is ready)
- `app/(app)/settings/page.tsx` — Account info + GCal calendar toggle switches + LLM provider placeholder
- `app/(marketing)/page.tsx` — Landing page with sign-in CTA via `authClient.signIn.social`

**Decisions made:**
- Zod `.default()` removed from form schemas — zodResolver v5 with Zod v4 infers `.default()` fields as optional in the resolver, causing type mismatches; defaults moved to `useForm`'s `defaultValues` instead
- `oklch(100% 0 0 / N)` used for translucent white values in `@theme` (ghost/wire tokens) — oklch is Tailwind v4's native color space and handles alpha correctly
- `'use client'` added to hook files — explicitly marks them as client-only, prevents accidental server imports
- React Compiler warning on `form.watch()` accepted as known limitation of react-hook-form — doesn't affect runtime, just skips memoization on the TaskModal component

**Files touched:** 18 files

**Tests added:** 0 (UI components; test coverage in future session via webapp-testing or manual)

**Next action:**
- Session 5: `lib/gcal/` layer — auth.ts, calendars.ts, freebusy.ts, events.ts, errors.ts. Wire real `GCalAdapter` into runner.ts. Read `references/gcal-integration.md` first.

---

## 2026-04-16 — Session 3: Scheduler pure-function pipeline

**Goal for this session:** Build the full `lib/scheduler/` pipeline with unit tests.

**Built:**
- `references/scheduling-engine.md` — spec doc for the scheduler pipeline
- `lib/scheduler/types.ts` — shared types (ScheduleWindow, TimeSlot, BusyInterval, ScoredTask, PlacedChunk, RecurrenceRule)
- `lib/scheduler/urgency.ts` — pure urgency scoring (priority × deadline proximity)
- `lib/scheduler/candidates.ts` — filter + sort tasks ready to schedule; `buildDoneSet` helper
- `lib/scheduler/slots.ts` — `computeFreeSlots` (windows − blackouts − busy) + `consumeSlot`
- `lib/scheduler/placement.ts` — `placeTask` (first-fit, buffer-aware) + `placementConsumedRange`
- `lib/scheduler/splitting.ts` — `splitTask` (greedy chunk allocation across slots)
- `lib/scheduler/recurrence.ts` — `generateOccurrences` (daily/weekly/monthly/yearly + byDayOfWeek + until + count)
- `lib/scheduler/runner.ts` — orchestrator with real DB logic + `GCalAdapter` interface for injectable GCal calls (stubbed until lib/gcal/ exists)
- 64 unit tests across 6 test files — all passing

**Decisions made:**
- `runner.ts` accepts `GCalAdapter` as an optional parameter rather than importing from `lib/gcal/` directly — keeps GCal decoupled until that layer is built, and makes the runner unit-testable without a GCal mock
- `until` in RecurrenceRule treated as end-of-day (23:59:59) so occurrences on the until date are always included
- `buildDoneSet` treats both `'done'` and `'scheduled'` statuses as satisfying dependencies

**Files touched:** 15 files created

**Tests added:** 64

**Next action:**
- Session 4: `lib/gcal/` — auth.ts, calendars.ts, freebusy.ts, events.ts, errors.ts. Wire real `GCalAdapter` into runner.ts. Read `references/gcal-integration.md` first.

---

## 2026-04-15 — Session 2: Tasks/Tags/Views/Calendars CRUD

**Goal for this session:** Build full CRUD for tasks (with tags), tags, views, and a calendar list/select endpoint.

**Built:**
- `lib/auth/helpers.ts` — `requireAuth()` helper (returns userId or 401 Response)
- `lib/services/tasks.ts` — listTasks, getTask, createTask, updateTask, deleteTask; tasks returned with `tags[]`
- `app/api/tasks/route.ts` + `app/api/tasks/[id]/route.ts` — full CRUD, Zod validation
- `lib/services/tags.ts` — full CRUD
- `app/api/tags/route.ts` + `app/api/tags/[id]/route.ts`
- `lib/services/views.ts` — full CRUD
- `app/api/views/route.ts` + `app/api/views/[id]/route.ts`
- `lib/services/calendars.ts` — listCalendars, setCalendarSelected
- `app/api/calendars/route.ts` + `app/api/calendars/[id]/route.ts`
- Integration tests for all four feature groups (mocked services + auth helper via vi.doMock)

**Decisions made:**
- Services mocked in integration tests via `vi.doMock()` (not `vi.mock()`) for per-test isolation — avoids Vitest hoisting constraints
- `requireAuth()` returns `{ userId } | Response` — checked with `instanceof Response` in each handler
- Tasks always returned with `tags[]` array — service handles the join
- `z.record(z.string(), z.unknown())` used instead of `z.record(z.unknown())` — Zod 4 requires two arguments

**Files touched:** 17 files created

**Tests added:** ~32

**Next action:**
- Session 3: Scheduler pure-function pipeline (`lib/scheduler/urgency.ts`, `slots.ts`, `placement.ts`, `splitting.ts`, `recurrence.ts`, `candidates.ts`, `runner.ts`) with unit tests. Read `references/scheduling-engine.md` first.

---

## 2026-04-15 — Session 1: Base project setup

**Goal for this session:** Bootstrap the Next.js 16 app with TypeScript strict, Tailwind v4, Drizzle+Neon, Better Auth+Google OAuth, ESLint custom rules, `/api/health`, Vitest+msw, and route group scaffolding.

**Built:**
- `pnpm create next-app` baseline — Next.js 16.2.3, React 19, TypeScript strict, Tailwind v4, App Router
- ESLint custom rules: `no-project-entity` (bans `Project`/`projectId`/`projects` identifiers) + `no-llm-provider-imports` (bans direct LLM provider SDKs outside `lib/llm/` and `lib/plugins/builtin/`)
- Drizzle ORM 0.45.2 + `@neondatabase/serverless` configured via `lib/db/client.ts`
- Full Drizzle schema: `user`, `session`, `account`, `verification` (Better Auth), `tasks` (no `projectId`), `tags`, `taskTags`, `views`, `blackoutDays`, `scheduleWindows`, `scheduleLogs`, `googleAccounts`, `googleCalendars`, `jobs` (partial unique index on `idempotencyKey`), `scratchpads`, `scratchpadPluginConfigs`, `pluginInstalls`
- Schema integrity: self-referencing FK on `tasks.parentTaskId`, unique constraints on `googleAccounts(userId, googleAccountId)`, `googleCalendars(googleAccountId, calendarId)`, `pluginInstalls(userId, pluginName)`, performance indexes on `tasks(userId, status)` and `jobs(status, runAfter)`
- Better Auth 1.6.4 + Google OAuth (single flow grants app login + `https://www.googleapis.com/auth/calendar` scope), `accessType: 'offline'` for refresh tokens
- `/api/auth/[...all]` catch-all handler via `toNextJsHandler`
- `/api/health` — DB connectivity smoke test (200 on success, 503 on failure)
- `vitest.config.ts` + `vitest.setup.ts` (msw node server), `tests/unit/health.test.ts` — 2/2 passing
- `app/(marketing)/` route group — landing page placeholder
- `app/(app)/` route group — auth guard (redirects to `/` if unauthenticated) + dashboard placeholder
- `components/providers.tsx` — TanStack Query provider
- `vercel.json` — cron declaration for `/api/cron/drain` (every minute)
- `.env.local.example` with all required env vars documented
- `lib/utils/id.ts` — CUID2 wrapper

**Decisions made:**
- All decisions follow ADRs 001–R13. No new ADRs needed.
- Better Auth adapter uses `camelCase: true` to match Drizzle's camelCase field names.
- `tasks.parentTaskId` uses a lazy self-referencing FK (`(): AnyPgColumn => tasks.id`) to avoid circular import.
- ESLint config uses native Next.js 16 flat config format (no FlatCompat needed).

**Files touched:** ~35 files created, 3 modified

**Tests added:** 2

**Next action:**
- Session 2: Tasks CRUD — `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` + Tags CRUD + Views CRUD, service layer under `lib/services/`, integration tests via msw. Start by reading `references/api-contract.md`.
