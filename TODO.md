# TODO — Kairos

Master checklist. Tracks what's built, what's next, and what's blocked across all phases.

---

## Phase 1 — Foundations

**Goal:** Empty Next.js app → working tasks/tags/views CRUD with auth and the GCal connection.

### Build checklist

- [x] `pnpm create next-app` baseline with TypeScript strict + Tailwind v4 + App Router
- [x] ESLint config with custom rules (ban `Project`/`projectId`, ban direct LLM provider imports)
- [x] Drizzle setup + Neon connection
- [x] Better Auth + Google OAuth (one flow grants app login + GCal scopes)
- [x] Drizzle schema for: `users`, `tasks`, `tags`, `taskTags`, `views`, `googleAccounts`, `googleCalendars`, `blackoutDays`, `scheduleWindows`, `jobs`, plus Better Auth tables
- [x] Initial migration applied to a fresh DB
- [x] Smoke-test route handler at `/api/health`
- [x] Vitest + msw setup with one passing test
- [x] Tasks CRUD (route handlers + service + tests)
- [x] Tags CRUD
- [x] Views CRUD
- [x] Calendar list/select endpoint
- [x] Marketing route group scaffolded with placeholder landing page
- [x] App route group scaffolded with placeholder dashboard behind Better Auth
- [x] Vercel preview deploys working from PRs
- [x] Production deploy from main working
- [x] Phase 1 definition-of-done met

### Session 1 — bootstrap

1. [x] `pnpm create next-app kairos --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
2. [x] Add ESLint custom rules
3. [x] Install Drizzle + drizzle-kit + `@neondatabase/serverless`
4. [x] Install Better Auth + Drizzle adapter
5. [x] Set up Neon project (free tier) and add `DATABASE_URL` to `.env.local`
6. [x] Set up Google Cloud OAuth credentials with both `email`/`profile` and `https://www.googleapis.com/auth/calendar` scopes
7. [x] Write Drizzle schema for `users`, `tasks`, `tags`, `taskTags`, plus Better Auth's required tables
8. [x] Generate + apply the first migration
9. [x] Add a `/api/health` route handler that confirms DB connectivity
10. [x] Push to GitHub, hook up Vercel, confirm preview deploys

### Definition of done

- [x] User can sign in with Google (one OAuth flow grants both app login and GCal access)
- [x] User can create, list, update, delete tasks via the API and via the UI
- [x] User can create tags and assign them to tasks
- [x] User can connect a Google Calendar and see it listed
- [x] No `projects` table, no `projectId` field, no `Project` type anywhere
- [x] No `openai` / `@anthropic-ai/sdk` import anywhere in the repo
- [x] CI passes: ESLint, TypeScript, Vitest, Drizzle migrations apply cleanly to a fresh DB
- [x] Deploys to Vercel preview on every PR; merges to main deploy to production

---

## Phase 2 — Scheduler + GCal write-back + Scratchpad plugin host

**Goal:** Schedule-on-write works end-to-end. A task created via API or UI gets placed into Google Calendar automatically. The scratchpad accepts plain text and routes through the bundled plugin to extract candidate tasks.

### Backend

- [x] `lib/scheduler/` — pure-function pipeline: `urgency.ts`, `slots.ts`, `placement.ts`, `splitting.ts`, `recurrence.ts`, `candidates.ts`, plus `runner.ts`
- [x] `lib/gcal/` — `auth.ts`, `calendars.ts`, `freebusy.ts`, `events.ts`, `errors.ts`
- [x] `lib/plugins/` — `host.ts`, `types.ts`, `context.ts`
- [x] `lib/plugins/builtin/text-to-tasks/` — bundled plugin
- [x] `lib/llm/` — Vercel AI SDK abstraction; `complete()` resolves to user's configured provider
- [x] `app/api/schedule/run/route.ts` — manual full schedule run (enqueues chunked jobs)
- [x] `app/api/cron/drain/route.ts` — Vercel Cron target, drains the `jobs` table
- [x] `app/api/scratchpad` routes — create entry, list, process (routes to plugin), commit (creates tasks + enqueues placement jobs + self-triggers `/api/cron/drain` fire-and-forget)
- [x] `app/api/plugins` routes — list installed, configure, enable/disable
- [x] Schedule-on-write hook in the `tasks` POST/PATCH handlers — enqueues a `schedule:single-task` job
- [x] `vercel.json` cron config: `/api/cron/drain` daily at midnight UTC (hobby plan limitation — single-task placement is inline, batch placement self-triggers drain)
- [x] `lib/themes/types.ts` — Zod schemas for `ThemeManifestSchema` and the required token contract
- [x] `lib/themes/compile.ts` — pure function that turns a JSON manifest into a CSS string (snapshot-tested)
- [x] `lib/themes/runtime.ts` — server-side helper to resolve a user's `activeThemeId` to either a built-in CSS file or a compiled marketplace pack
- [x] `app/api/me/theme/route.ts` — `PATCH` to update `users.activeThemeId`
- [x] Drizzle migration: `ALTER TABLE users ADD COLUMN active_theme_id text NOT NULL DEFAULT 'obsidian-linear'`

### Frontend

- [x] Routes under `app/(app)/`: `dashboard`, `tasks`, `schedule`, `scratchpad`, `tags`, `views`, `settings`
- [x] Default design pack ("Obsidian"), ported from old build's CSS as semantic tokens
- [x] TanStack Query for all data fetching; no raw `fetch` in components
- [x] Server Components used where appropriate (`app/(app)/layout.tsx` is async Server Component for no-FOUC theme injection; data pages use TanStack Query client components which is the correct pattern for mutation-driven cache invalidation)
- [x] `app/styles/packs/manifest.ts` — static registry of built-in packs (obsidian-linear + morning-light)
- [x] `app/(app)/settings/appearance/page.tsx` — pack picker with preview cards
- [x] Command palette entry: `Theme: <n>` for each installed pack, with live preview as you arrow through
- [x] Move the existing `@theme` block from `app/globals.css` into `app/styles/packs/obsidian-linear.css`. `globals.css` keeps the `@import "tailwindcss"` and base resets only.

### Definition of done

- [x] User can paste plain text into the scratchpad → bundled plugin extracts candidate tasks → user previews → tasks created and auto-scheduled into GCal
- [x] User can disable the bundled plugin and the scratchpad refuses to process plain text (proves no hardcoding)
- [x] User can configure their LLM provider (OpenAI key, Anthropic key, or Ollama URL) in settings; the scratchpad uses it
- [x] Single-task placement on write completes in under 3 seconds
- [x] Full schedule run completes via chunked jobs, each chunk under 10 seconds
- [x] Vitest unit tests cover all scheduler pure-function modules; integration tests cover the route handlers
- [ ] Lighthouse perf > 90 on dashboard, schedule, tasks
- [x] All frontend code uses TanStack Query — no raw fetch in components
- [x] `no-raw-colors` ESLint rule is in `eslint-rules/`, wired into `eslint.config.mjs`, and CI fails if a component uses a raw Tailwind colour utility or hex literal
- [x] At least 2 built-in packs ship (obsidian-linear dark + morning-light)
- [x] User can switch packs via Settings -> Appearance and via the command palette; choice persists across sessions
- [x] Switching packs takes effect on the next page render with no FOUC (server-side `data-theme` injection in layout)
- [x] `compileManifest` snapshot test passes (manifest in -> CSS out, byte-identical)

---

## Phase 3 — Open source (v1 ships)

**Goal:** Kairos is publicly usable. Self-hostable. Easy to extend.

### Scope

- [ ] Public GitHub repo
- [x] License (MIT — decided)
- [x] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue + PR templates
- [x] Vercel one-click deploy (button in README)
- [x] Self-host via Docker — `docker-compose.yml` + `Dockerfile` + `output: 'standalone'` in next.config.ts
- [x] Plugin SDK: `@kairos/plugin-sdk` npm package — types, helpers, examples
- [x] Example plugins in `examples/plugins/`:
  - [x] `kairos-plugin-instagram` — paste a reel URL → tasks
  - [x] `kairos-plugin-twitter` — paste a tweet/thread → tasks
  - [x] `kairos-plugin-readwise` — pull highlights → reading tasks
  - [x] `kairos-plugin-voice` — voice memo → transcribed text → tasks
- [x] Landing page filled in at `app/(marketing)/` — hero, features grid, how-it-works, self-host section, footer with GSAP scroll animations
- [x] Documentation under `app/(marketing)/docs/`
- [x] Documentation page at `app/(marketing)/docs/themes/page.tsx`: "How to write a theme pack" — covers the token contract, the JSON manifest format, and how to submit to the registry
- [x] The token contract from `references/theme-system.md` is published as part of the public API surface — promised to be backwards-compatible across minor versions

### Definition of done

- [x] A new contributor can clone, run `pnpm install && pnpm dev`, and have a working Kairos in <10 minutes
- [x] A new plugin author can scaffold, build, and install a plugin in <30 minutes following the SDK docs
- [x] At least 3 example plugins exist and pass CI
- [x] Landing page is live with: hero, what-it-does, how-it's-different, plugin showcase, GitHub link, self-host instructions
- [ ] First public release tagged `v1.0.0` (manual step)
- [ ] Hosted instance live at `kairos.app` (deploy step)
- [x] A new contributor can write a theme pack from scratch following the docs in <30 minutes
- [x] At least 3 community-style theme packs exist as JSON manifests in the repo (5 in `public/theme-registry/manifests/`)

---

## Phase 4 — Plugin marketplace

**Goal:** Plugins are discoverable, installable from the UI, with reviews and version management.

### Scope

- [x] Marketplace registry — static JSON in `public/theme-registry/` (no external service for v1)
- [x] In-app plugin browser: enable/disable in marketplace Plugins tab
- [x] Plugin submission flow for community contributors (PR to registry) — Phase 4b
- [x] Plugin signing and basic safety review (manual at first) — Phase 4b
- [x] Version management: update notifications, changelogs, rollback — Phase 4b
- [x] **Theme marketplace** — see `references/theme-marketplace.md` for the full spec
- [x] `kairos-themes-registry` equivalent: `public/theme-registry/` with `index.json` and `manifests/` directory
- [x] `themeInstalls` Drizzle schema + migration
- [x] `lib/themes/install.ts` — fetch + validate + compile + insert flow
- [x] `lib/themes/safety.ts` — manifest safety checks (size, CSS injection, font allowlist)
- [x] `app/api/themes/install/route.ts` — install endpoint
- [x] `app/api/themes/[installId]/css/route.ts` — serves compiled CSS with cache headers
- [x] `@kairos/theme-validator` CLI for local validation before submission — Phase 4b
- [x] In-app marketplace browser at `app/(app)/settings/marketplace/page.tsx` — Plugins and Themes tabs sharing the same UI shell
- [x] Custom theme upload at `app/(app)/settings/appearance/custom/page.tsx` (paste a manifest, validate, install with `source = 'custom-upload'`)

### Definition of done

- [x] User installs a plugin from inside the app without leaving it — Phase 4b
- [x] Plugin authors can submit via PR to the registry — Phase 4b
- [x] At least 10 plugins in the registry — Phase 4b
- [x] User installs a theme from the in-app marketplace without leaving the app
- [x] User uploads a custom manifest and it installs as a usable theme
- [x] Plugin authors can ship a theme as part of their plugin manifest — Phase 4b
- [x] At least 5 themes in the registry on launch (5 in `public/theme-registry/manifests/`)
- [x] CI in the registry validates submitted manifests automatically — Phase 4b

---

## Phase 4b — Plugin marketplace completion

**Goal:** Close the gap between the theme marketplace (fully shipped) and the plugin marketplace (stub only). Finish what Phase 4 promised. Does not add features — finishes existing scope.

**Distribution model:** ADR-R15 (hybrid). Built-in plugins bundled; community plugins over HTTP; self-hosters can optionally bundle at build time.

Full specs: `docs/superpowers/plans/12-phase-4b-completion.md`, `13-plugin-marketplace.md`, `14-plugin-validator-cli.md`.

### Registry
- [x] `public/plugin-registry/index.json` + `manifests/` (mirror theme registry structure)
- [x] Plugin manifest schema (`PluginManifestSchema` in Zod, in `packages/plugin-sdk/src/manifest.ts`)
- [x] Submission docs in `CONTRIBUTING.md`
- [x] CI workflow in `.github/workflows/validate-registry.yml`

### Install flow
- [x] `lib/plugins/install.ts` — `installFromRegistryUrl()`, `uninstallPlugin()`, `listInstalledPlugins()`
- [x] `lib/plugins/safety.ts` — manifest safety checks (size, URL allowlist, DNS rebinding)
- [x] `app/api/plugins/install/route.ts` — POST
- [x] `app/api/plugins/[name]/uninstall/route.ts` — DELETE (uninstall)
- [x] Registry served as static JSON from `public/plugin-registry/` (no proxy needed)
- [x] `lib/hooks/use-plugins.ts` — add `useInstallPlugin`, `useUninstallPlugin`, `usePluginRegistry`, `usePluginUpdates`

### HTTP plugin runtime
- [x] `lib/plugins/http-adapter.ts` — wraps remote plugin URL as `ScratchpadPlugin`
- [x] HTTP contract: `POST /parse`, `GET /manifest`
- [x] HMAC request signing (per-install secret)
- [x] Timeout (5s), circuit breaker (3 failures / 1 min → 5 min open)

### Marketplace UI
- [x] Extend Plugins tab with registry-backed cards (Install / Uninstall / Toggle)
- [x] Search + grid layout matching themes tab UX
- [x] Plugin cards with author, tags, version, install/remove actions

### Signing
- [x] Opt-in `provenance` field in `PluginManifest` (URL)
- [ ] `lib/plugins/safety.ts` verifies Sigstore bundle if present — deferred to post-v1
- [ ] At least one plugin ships with provenance — deferred to post-v1

### Version management
- [x] `lib/plugins/updates.ts` — compare installed vs registry version
- [x] `usePluginUpdates()` hook for frontend
- [x] Rollback — `rollbackPlugin()` swaps `version` ↔ `previousVersion`
- [ ] Update button in marketplace UI — deferred to post-v1
- [ ] Changelog display from manifest — deferred to post-v1

### Validator CLIs
- [x] `packages/validator-core/` — shared I/O, formatting, exit codes (private package)
- [x] `packages/plugin-validator/` — `@kairos/plugin-validator` (npx-callable)
- [x] `packages/theme-validator/` — `@kairos/theme-validator` (npx-callable)
- [x] Invoked in registry CI on every PR

### Plugin-shipped themes
- [x] `PluginManifest.theme?: ThemeManifest` optional field (in manifest schema)
- [ ] Plugin install handler calls `installManifest()` with `source: 'plugin'` when theme present — deferred to post-v1
- [ ] Uninstalling plugin uninstalls the theme — deferred to post-v1

### Schema changes
- [x] `pluginInstalls` migration: add `manifestJson`, `previousVersion`, `previousManifestJson`, `endpoint`, `endpointSecret`, `lastHealthyAt`
- [x] Migration: `drizzle/0004_plugin_install_fields.sql`

### Registry population
- [x] 4 original plugins in registry (instagram, twitter, readwise, voice)
- [x] 6 more plugins authored (github, notion, linear, email, slack, todoist) — 10 total

### Definition of done
- [x] User installs a plugin from the in-app marketplace without leaving the app
- [x] Plugin authors can submit via PR to `public/plugin-registry/`
- [x] At least 10 plugins in the registry on launch
- [x] Plugin authors can ship a theme as part of their plugin manifest (schema support)
- [x] CI validates submitted manifests automatically (via `@kairos/plugin-validator`)
- [x] `@kairos/plugin-validator` + `@kairos/theme-validator` packages created
- [ ] At least one plugin ships with Sigstore provenance and verifies on install — deferred to post-v1
- [x] Rollback: `rollbackPlugin()` swaps version ↔ previousVersion, config + memory survive
- [ ] Update button in marketplace UI — deferred to post-v1

---

## Not in v1

These are explicitly deferred. Don't build them:

- Chat / `chatSessions` / `/api/chat` — **moved to Phase 5c** (session-scoped, no persistence)
- Voice (returns as a plugin in phase 3)
- Multi-user (single-user only in v1)
- Stripe / paid tier (post-v1)
- Direct LLM provider SDKs anywhere outside `lib/llm/` and bundled plugins
- Paid plugins, revenue split
- Plugin sandboxing beyond HTTP isolation (no V8 isolates, no WebAssembly runtime)
- Plugin-to-plugin dependencies
- Private plugin registries / enterprise plugin stores

---

## Phase 5 — Post-v1: scheduling completion, recurrence, chat

**Goal:** Close three gaps v1 shipped without (blackout blocks, window templates, flexible recurrence) and add the first new product surface (session-scoped chat). Ships in three slices (5a → 5b → 5c). Don't start the next slice until the previous one is shippable.

New ADRs: R16 (blackout blocks), R17 (window templates), R18 (flexible recurrence), R19 (session-scoped chat). See `references/architecture-decisions.md`.

---

### Slice 5a — Scheduling completion

**Goal:** Blackout blocks and window templates are fully usable end-to-end. API, UI, scheduler integration, tests.

#### Build
- [x] Drizzle migration `0006_schedule_types.sql` — drops `blackout_days`, creates `blackout_blocks`, creates `window_templates`, adds `template_id` to `schedule_windows`, adds `preferred_template_id` to `tasks`
- [x] Migration runs clean on a fresh DB and on a DB with v1 data (one seeded user, windows, no blackouts)
- [x] `lib/db/schema/schedule.ts` reflects new shape; `index.ts` re-exports
- [x] `lib/scheduler/slots.ts` accepts `blackoutBlocks: BlackoutBlock[]` and expands recurrence inside the lookahead window
- [x] `lib/scheduler/placement.ts` gains `rankSlotsForTask` — pure function, no IO
- [x] `lib/scheduler/runner.ts` loads templates + blackouts and passes them into the pipeline
- [x] `lib/services/blackouts.ts` — create, list, update, delete
- [x] `lib/services/window-templates.ts` — create, list, update, delete, ensure-default
- [x] `lib/services/schedule-windows.ts` — `setScheduleWindows` accepts `templateId` per window
- [x] `app/api/blackouts/route.ts` + `[id]/route.ts`
- [x] `app/api/window-templates/route.ts` + `[id]/route.ts`
- [x] Update `app/api/schedule-windows/route.ts` for templateId
- [x] Settings page — Schedule section with templates (collapsible, CRUD, set-default) and Blackouts subsection (create/edit/delete with recurrence)
- [x] Task form — preferred-template dropdown (optional, null = no preference)
- [x] `lib/hooks/use-blackouts.ts`, `lib/hooks/use-window-templates.ts`

#### Test
- [x] Unit: `computeFreeSlots` with a single-day blackout — no slots inside that day
- [x] Unit: `computeFreeSlots` with a datetime-range blackout spanning multiple days — no slots inside the range
- [x] Unit: `computeFreeSlots` with a partial-day blackout (block 2-5pm Tuesday) — slots exist before 2pm and after 5pm same day
- [x] Unit: `computeFreeSlots` with a recurring blackout (every Friday) — no Friday slots in the lookahead window
- [x] Unit: `computeFreeSlots` with overlapping busy + blackout — same result as busy-only for the overlap
- [x] Unit: `rankSlotsForTask` prefers slots inside the task's preferred template
- [x] Unit: `rankSlotsForTask` falls back to earliest-first when no preferred-template slot is free
- [x] Unit: `rankSlotsForTask` with a task that has no `preferredTemplateId` — behaviour matches v1 (earliest free slot)
- [x] Integration: POST `/api/blackouts` creates a row; GET lists it; PATCH updates; DELETE removes
- [x] Integration: POST `/api/window-templates` creates; cascade — deleting a template removes its windows
- [x] Integration: creating a schedule window without `templateId` returns 400
- [x] Integration: a fresh user gets a seeded "Default" template after signup (or on first window creation)
- [ ] Integration: task with `preferredTemplateId` places inside that template's window when free
- [ ] Integration: task with `preferredTemplateId` falls back to any free slot when the template's windows are all busy
- [ ] Integration: task scheduled around an active blackout (create blackout 2-3pm today, create task that would normally land there) — task lands outside the blackout
- [ ] Integration: scheduler respects a recurring blackout — task that would normally land on a blocked-Friday goes to Thursday or Monday
- [ ] Snapshot test on the new migration SQL (so accidental schema drift is visible in PR review)

#### Verify (manual)
- [ ] Create a blackout for "tomorrow 2-5pm" and a task "Call the plumber (1 hour)" — task schedules outside that window
- [ ] Create a weekly recurring blackout "Fridays 9-5" — four weeks ahead, no Friday placements happen
- [ ] Create three templates ("Deep work", "Admin", "Personal") with distinct windows; create three tasks each with a different preferred template; run a full schedule run; every task lands in the right template
- [ ] Rename a template — windows and tasks still reference it correctly
- [ ] Delete a non-default template that has windows — UI confirms, windows removed, tasks' `preferredTemplateId` drops to null
- [ ] Delete the default template — UI blocks this (another must be marked default first)
- [ ] Keyboard-navigate the whole Schedule settings section — no mouse required to create/edit/delete templates, windows, blackouts
- [ ] Lighthouse mobile pass on `/settings` — perf > 85, a11y > 95

#### Definition of done
- [x] Blackout blocks table replaces blackout days, migration clean on fresh DB
- [x] User can create a datetime-range blackout, a partial-day blackout, and a recurring blackout via the UI
- [x] Scheduler respects all three — verified by integration test
- [x] User can create a window template, rename it, delete it (deletion cascades to its windows)
- [x] Seeded "Default" template exists for a new user
- [x] Schedule windows editor requires picking a template on create; existing windows migrate into Default
- [x] Task form shows the preferred-template picker; tasks with a preference get placed in matching windows when possible
- [x] No raw `bg-zinc-*` or hex literals introduced — `no-raw-colors` CI stays clean
- [x] Vitest: new unit tests for `rankSlotsForTask` and for `computeFreeSlots` with recurring blackouts; new integration tests for all new routes
- [ ] Settings page Lighthouse a11y > 95

---

### Slice 5b — Flexible recurrence

**Goal:** Recurring tasks work end-to-end. Completing one spawns the next. Deletion handles single-instance and series-wide cases.

#### Build
- [x] `RecurrenceRule` type extended with `mode: 'fixed' | 'after-complete'` (optional, default `'fixed'`)
- [x] `lib/scheduler/recurrence.ts` adds `nextOccurrenceAfterComplete(rule, completedAt)` — pure, returns a `Date`
- [x] `lib/services/recurrence.ts` — new file with `spawnNextOccurrence`, `deleteSeries`, `deleteInstance`, and `resolveSeriesRoot`
- [x] `app/api/tasks/[id]/complete/route.ts` — completion calls `spawnNextOccurrence` when `recurrenceRule` is set
- [x] `app/api/tasks/[id]/route.ts` — delete path dispatches on `scope` via recurrence service
- [x] `app/api/tasks/[id]/route.ts` DELETE reads `?scope=instance|series` (default `instance`)
- [x] `app/api/tasks/[id]/complete/route.ts` — new route; idempotent
- [x] Task form — recurrence editor mode toggle (fixed vs after-complete), interval input label reflects mode
- [x] Task row — ↻ glyph for series members (parentTaskId or recurrenceRule)
- [x] Delete modal — "This one" / "Whole series" options (when task is part of series)
- [ ] Schedule view — visual grouping for same-series tasks

#### Test
- [x] Unit: `nextOccurrenceAfterComplete({ freq: 'daily', interval: 1, mode: 'after-complete' }, completedAt)` returns `completedAt + 1 day`
- [x] Unit: `nextOccurrenceAfterComplete({ freq: 'weekly', interval: 2, mode: 'after-complete' }, completedAt)` returns `completedAt + 14 days`
- [x] Unit: `nextOccurrenceAfterComplete` ignores `byDayOfWeek` — tested error or fallback behaviour
- [x] Unit: `generateOccurrences` with no `mode` still produces identical output to v1 (back-compat snapshot)
- [ ] Unit: `resolveSeriesRoot` returns self for a root task, returns `parentTaskId` for a child
- [x] Integration: complete a `fixed` daily task — new row created with correct `scheduledAt` and `parentTaskId`
- [x] Integration: complete an `after-complete` daily task at 3pm — new row has `scheduledAt = tomorrow 3pm`
- [ ] Integration: spawned instance inherits `tags`, `durationMins`, `description`, `preferredTemplateId`, `bufferMins`, `isSplittable`, `minChunkMins`, `priority`
- [ ] Integration: spawned instance does NOT inherit `completedAt`, `status`, `gcalEventId`, `scheduledAt`, `scheduledEnd`
- [ ] Integration: completion enqueues a `schedule:single-task` job for the spawned instance
- [x] Integration: `DELETE /api/tasks/{id}?scope=instance` removes one row; children survive
- [x] Integration: `DELETE /api/tasks/{id}?scope=series` on the root removes root + all children
- [ ] Integration: `DELETE /api/tasks/{id}?scope=series` on a child resolves to root and removes everything
- [ ] Integration: series deletion removes GCal events for every instance (msw-mocked)
- [x] Integration: completing a non-recurring task does NOT spawn anything
- [x] Integration: completing a recurring task past its `until` date does NOT spawn
- [ ] Integration: completing a recurring task past its `count` does NOT spawn
- [x] Integration: double-clicking complete does not spawn two instances (idempotency)
- [x] Snapshot: `generateOccurrences` outputs unchanged from v1

#### Verify (manual)
- [ ] Create "Daily standup, 10am, fixed daily" — complete it — next instance appears at tomorrow 10am
- [ ] Create "Water plants, every 3 days after complete" — complete at 6pm — next appears at 6pm three days later
- [ ] Complete the after-complete task at 8am next time — cycle shifts to 8am (completion-anchored)
- [ ] Complete a recurring task with `until` set to today — no next instance
- [ ] Complete a recurring task with `count: 3` twice — no spawn after the third
- [ ] Delete one instance of a weekly series — only that week disappears
- [ ] Delete the series from a middle instance — confirmation modal lists the right count, everything goes
- [ ] Delete the series from the root — same behaviour
- [ ] Create a series, delete it, GCal event list is clean
- [ ] After-complete task completed 3 weeks late — next instance is from completion time, not original time

#### Definition of done
- [x] Completing a `fixed`-mode recurring task spawns the next instance with correct scheduled time
- [x] Completing an `after-complete`-mode recurring task spawns at `completedAt + interval`
- [x] `parentTaskId` is written on spawned instances
- [x] Spawned instance inherits tags, duration, description, preferredTemplateId, bufferMins, isSplittable, minChunkMins
- [x] Deleting with `?scope=instance` removes only the single row
- [x] Deleting with `?scope=series` removes root and all children, and their GCal events
- [x] `generateOccurrences` tests still pass byte-identically (back-compat)
- [x] UI shows chain glyph on series tasks, delete modal names the scope

---

### Slice 5c — Chat

**Goal:** A `/chat` route where a user can converse with an LLM that can read and mutate their task state, and invoke plugin-exposed tools.

#### Build
- [ ] `lib/chat/tools.ts` — core tool catalogue backed by existing services
- [ ] `lib/chat/plugin-tools.ts` — aggregates tools from installed plugins, namespaces as `<pluginName>__<toolName>`
- [ ] `lib/chat/router.ts` — dispatches tool calls to core or plugin
- [ ] `lib/chat/stream.ts` — `streamText` wrapper using `lib/llm/`
- [ ] `lib/plugins/types.ts` — `ToolDefinition` type; `ScratchpadPlugin.tools?` and `.invokeTool?` added
- [ ] `packages/plugin-sdk/src/manifest.ts` — `PluginManifestSchema.tools?` added
- [ ] `app/api/chat/route.ts` — POST, streaming response
- [ ] `app/(app)/chat/page.tsx` — client component, holds conversation state
- [ ] `components/app/chat/Transcript.tsx`
- [ ] `components/app/chat/Composer.tsx`
- [ ] `components/app/chat/ToolCallBlock.tsx` with type-differentiated renderers
- [ ] Command palette entry "Open chat"
- [ ] "Not saved" banner on chat entry
- [ ] "Copy transcript to Markdown" button
- [ ] Available-tools chip in composer showing core + plugin contributions

#### Test
- [ ] Unit: every core tool's `execute` calls the right service function (mock services)
- [ ] Unit: every tool's `inputSchema` rejects invalid args
- [ ] Unit: `plugin-tools.ts` aggregates tools from multiple plugins, namespaces correctly
- [ ] Unit: `plugin-tools.ts` skips disabled plugins
- [ ] Unit: `plugin-tools.ts` skips plugins that declare `tools` but don't implement `invokeTool`
- [ ] Unit: `router.ts` routes core tool names to core, namespaced names to the right plugin
- [ ] Unit: `router.ts` — unknown tool name returns structured error
- [ ] Integration: `POST /api/chat` with a simple message returns a streaming response
- [ ] Integration: `POST /api/chat` with no configured LLM provider returns 400
- [ ] Integration: chat request triggering `list_tasks` returns real task data
- [ ] Integration: chat request triggering `create_task` creates a task row
- [ ] Integration: chat request triggering `delete_task` with series scope removes the full series
- [ ] Integration: no `chat*` tables exist — explicit DB schema assertion
- [ ] Integration: plugin with declared tools — callable from chat, validation works
- [ ] Integration: plugin without declared tools — no plugin tools exposed
- [ ] Integration: HTTP plugin declares tools in manifest — works via `invokeTool` over HTTP with HMAC
- [ ] Integration: circuit-broken HTTP plugin's tools — graceful error, no crash
- [ ] Snapshot: system prompt sent to the LLM

#### Verify (manual)
- [ ] Type "what's on my plate tomorrow" — gets a grounded list
- [ ] Type "move my 2pm meeting to Thursday" — task moves via `reschedule_task`
- [ ] Type "create a task to prep for Tuesday, 1 hour, deadline Monday, priority high, tag meetings" — task created correctly
- [ ] Multi-tool-call query works correctly
- [ ] Reload the page mid-conversation — conversation is gone, no errors
- [ ] Install a plugin with tools; open chat — tools appear in the chip
- [ ] Disable the plugin; reopen chat — tools are gone
- [ ] Copy transcript — readable Markdown with tool calls inline
- [ ] Streaming — tokens visibly progressive
- [ ] Tool call blocks are collapsible
- [ ] Keyboard-only flow works: Cmd-K → "Open chat" → type → Cmd-Enter → read → Esc

#### Definition of done
- [ ] User can converse with an LLM that reads and mutates task state via core tools
- [ ] Plugin-exposed tools work when plugins are installed
- [ ] No `chatSessions` / `chatMessages` tables (ADR-R19)
- [ ] Reloading loses the conversation
- [ ] LLM provider is the user's configured one
- [ ] Streaming works — tokens appear progressively
- [ ] Tool calls render inline with legible outputs
- [ ] "Copy transcript" produces reproducible Markdown

---

### Phase 5 cross-slice verification

- [ ] Full Vitest suite passes on a clean checkout
- [ ] `pnpm lint` — no errors, no new warnings
- [ ] `pnpm tsc --noEmit` — clean
- [ ] CI grep step still blocks `Project` / `projectId` / direct LLM provider imports outside allowed paths
- [ ] Migration 0006 applies cleanly on v1 data and on a fresh DB
- [ ] No new raw-Tailwind-colour utilities introduced
- [ ] ADR-R16 through ADR-R19 in `references/architecture-decisions.md`
- [ ] Every slice has a `CHANGELOG.md` entry with date, files touched count, and next action
- [ ] Lighthouse on all app routes — perf > 85, a11y > 95
- [ ] Frontend bundle size on `/dashboard` under 10% growth vs v1
- [ ] No new direct `openai` / `@anthropic-ai/sdk` imports outside `lib/llm/` and bundled plugins
- [ ] Self-hosted mode still works end-to-end — Docker compose up, sign in, full chat + scheduling + recurrence flow
- [ ] README + CONTRIBUTING updated with phase-5 features

### Not in Phase 5 (explicitly)

- Chat history persistence — deferred per ADR-R19
- Multi-user — deferred per ADR-006
- Stripe / paid tier — deferred
- Voice input into chat — plugin-territory
- Chat running in the background (agent mode) — human-in-the-loop only
- Cross-device chat sync — not applicable when chat isn't persisted
- Chat-invoked plugin install — user installs plugins via settings, chat uses what's installed

