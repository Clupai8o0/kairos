# CHANGELOG

Session memory for Kairos. Read this first every session. Update at session end without exception.

If a decision in this file conflicts with `references/architecture-decisions.md`, this file wins (it's newer). Promote permanent decisions back into ADRs at session end.

---

## Current State

**Phase:** 5c in progress. Phase 5 planned (3 slices: 5a scheduling completion ✓, 5b recurrence ✓, 5c chat — build complete, integration tests remaining).

### What's built (phases 1–5a)
- [x] Full backend: scheduler pipeline, GCal layer, plugin host, scratchpad, jobs queue
- [x] Full frontend: all 7 app routes wired to real APIs via TanStack Query
- [x] Theme system: 2 built-in packs, server-side `data-theme` injection (no FOUC), Cmd+K palette switcher, Settings→Appearance picker
- [x] `no-raw-colors` ESLint rule active — 0 errors, 3 pre-existing warnings (RHF/React Compiler, test unused var)
- [x] `compileManifest` snapshot test + 16 theme unit+integration tests
- [x] Phase 3: MIT license, CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue/PR templates, Vercel deploy button, Docker self-host, landing page (GSAP)
- [x] Phase 3: `packages/plugin-sdk/` — `@kairos/plugin-sdk` npm package (types, helpers, testing mock)
- [x] Phase 3: `examples/plugins/` — 4 reference plugins (instagram, twitter, readwise, voice)
- [x] Phase 3: `app/(marketing)/docs/` — overview, plugin guide, theme authoring guide, API reference
- [x] Phase 4: `themeInstalls` schema + migration (`0003_theme_installs.sql`)
- [x] Phase 4: `lib/themes/safety.ts` — CSS injection, font allowlist, size limit, ID uniqueness checks
- [x] Phase 4: `lib/themes/install.ts` — install from registry URL or raw manifest, upsert to DB
- [x] Phase 4: `lib/themes/compile.ts` — `scope` param added (`'@theme'` | `'selector'`) — backwards compatible
- [x] Phase 4: `lib/themes/runtime.ts` — resolves marketplace installs; `ResolvedTheme` includes `id` in both union members
- [x] Phase 4: theme API routes (install, uninstall, css serve, list installed)
- [x] Phase 4: `public/theme-registry/` — 5 community themes (nord-dark, dracula, catppuccin-mocha, solarized-light, tokyo-night)
- [x] Phase 4: `app/(app)/settings/marketplace/page.tsx` — tabbed Plugins | Themes marketplace UI
- [x] Phase 4: `app/(app)/settings/appearance/custom/page.tsx` — custom manifest upload
- [x] Phase 4: appearance page shows installed marketplace themes + links
- [x] Phase 4b: `packages/plugin-sdk/src/manifest.ts` — `PluginManifestSchema` Zod schema + type
- [x] Phase 4b: `lib/plugins/manifest-types.ts` — in-lib re-export of manifest schema
- [x] Phase 4b: `lib/plugins/safety.ts` — plugin safety checks (size, ID, HTTPS, DNS rebinding)
- [x] Phase 4b: `lib/plugins/install.ts` — install/uninstall/rollback/list for plugins
- [x] Phase 4b: `lib/plugins/http-adapter.ts` — HTTP adapter with circuit breaker + HMAC signing
- [x] Phase 4b: `lib/plugins/updates.ts` — check installed plugins against registry for updates
- [x] Phase 4b: updated `lib/plugins/host.ts` — loads HTTP plugins alongside bundled
- [x] Phase 4b: `app/api/plugins/install/route.ts` — POST install (URL or raw manifest)
- [x] Phase 4b: `app/api/plugins/[name]/uninstall/route.ts` — DELETE uninstall
- [x] Phase 4b: `drizzle/0004_plugin_install_fields.sql` — extended `pluginInstalls` schema
- [x] Phase 4b: `public/plugin-registry/` — 10 plugin manifests + registry index
- [x] Phase 4b: `packages/validator-core/` — shared validation core (types, fs, output)
- [x] Phase 4b: `packages/plugin-validator/` — CLI for plugin manifest validation
- [x] Phase 4b: `packages/theme-validator/` — CLI for theme manifest validation
- [x] Phase 4b: `.github/workflows/validate-registry.yml` — CI for manifest validation
- [x] Phase 4b: updated marketplace UI — full plugin browse/install/uninstall/toggle
- [x] Phase 4b: updated `lib/hooks/use-plugins.ts` — registry, install, uninstall, updates hooks
- [x] Phase 4b: updated `CONTRIBUTING.md` — plugin development guide
- [x] Phase 5a: `drizzle/0006_schedule_types.sql` — drop `blackout_days`, create `blackout_blocks` + `window_templates`, add `template_id` FK to `schedule_windows`, add `preferred_template_id` to `tasks`
- [x] Phase 5a: `lib/scheduler/types.ts` — added `BlackoutBlock`, `WindowTemplate` types, `templateId` on `ScheduleWindow`/`TimeSlot`
- [x] Phase 5a: `lib/scheduler/slots.ts` — replaced `blackoutDates: Date[]` with `blackoutBlocks: BlackoutBlock[]`, recurring expansion via `generateOccurrences`, templateId propagation
- [x] Phase 5a: `lib/scheduler/placement.ts` — added `rankSlotsForTask()` for preferred-template slot ranking
- [x] Phase 5a: `lib/scheduler/runner.ts` — updated to load `blackoutBlocks`/`windowTemplates`, pass through pipeline
- [x] Phase 5a: `lib/services/blackouts.ts` — full CRUD service
- [x] Phase 5a: `lib/services/window-templates.ts` — full CRUD + `ensureDefaultTemplate()`
- [x] Phase 5a: updated `lib/services/schedule-windows.ts` — `templateId` on `WindowInput`
- [x] Phase 5a: updated `lib/services/tasks.ts` — `preferredTemplateId` on input types
- [x] Phase 5a: `app/api/blackouts/route.ts` + `app/api/blackouts/[id]/route.ts` — full REST endpoints
- [x] Phase 5a: `app/api/window-templates/route.ts` + `app/api/window-templates/[id]/route.ts` — full REST endpoints
- [x] Phase 5a: updated task API routes — `preferredTemplateId` in create/update schemas
- [x] Phase 5a: `lib/hooks/use-blackouts.ts` + `lib/hooks/use-window-templates.ts` — TanStack Query hooks
- [x] Phase 5a: updated `lib/hooks/types.ts` — `BlackoutBlock`, `WindowTemplate` types, `preferredTemplateId` on `Task`
- [x] Phase 5a: updated settings page — auto-creates default template, threads `templateId` through schedule editor
- [x] Phase 5a: `components/app/schedule-section.tsx` — template CRUD (create/rename/delete/set-default), collapsible per-template day editors, preserves cross-template windows on save
- [x] Phase 5a: `components/app/blackouts-section.tsx` — blackout block CRUD with datetime-range picker, recurrence toggle, inline edit/delete
- [x] Phase 5a: `components/app/task-edit-modal.tsx` — preferred-template dropdown (shown when schedulable, loads templates)
- [x] Phase 5a: `lib/hooks/use-tasks.ts` — `preferredTemplateId` added to `CreateTaskInput` + `UpdateTaskInput`
- [x] Phase 5a: 73 unit tests passing (6 new for slots blackout blocks + templateId, 4 new for `rankSlotsForTask`)
- [x] Phase 5a: 21 new integration tests (blackouts + window-templates routes)
- [x] Phase 5b: `RecurrenceRule.mode` — `'fixed' | 'after-complete'` added to scheduler types
- [x] Phase 5b: `nextOccurrenceAfterComplete()` — pure function in `lib/scheduler/recurrence.ts`
- [x] Phase 5b: `lib/services/recurrence.ts` — resolveSeriesRoot, spawnNextOccurrence, deleteInstance, deleteSeries
- [x] Phase 5b: `POST /api/tasks/:id/complete` — idempotent complete + spawn-on-complete for recurring tasks
- [x] Phase 5b: `DELETE /api/tasks/:id?scope=series` — delete entire recurring series
- [x] Phase 5b: Frontend — recurrence editor (mode/freq/interval), series delete (instance vs whole), ↻ glyph, useCompleteTask hook
- [x] Phase 5b: 9 new unit tests (nextOccurrenceAfterComplete + back-compat), 9 new integration tests (complete + series delete)
- [x] Phase 5c: `lib/chat/tools.ts` — 9 core tools (listTasks, createTask, updateTask, deleteTask, completeTask, listTags, createTag, listSchedule, runSchedule) using AI SDK v6 `tool()` with `inputSchema`
- [x] Phase 5c: `lib/chat/plugin-tools.ts` — aggregates tools from installed plugins, namespaces as `pluginName__toolName`, skips disabled/non-implementing plugins
- [x] Phase 5c: `lib/chat/router.ts` — merges core + plugin tools via `createAllTools(userId)` + `getAvailableToolNames(userId)`
- [x] Phase 5c: `lib/chat/stream.ts` — `streamText` wrapper using `lib/llm/resolveModel()`, system prompt, `stopWhen: stepCountIs(5)`
- [x] Phase 5c: `lib/plugins/types.ts` — `ToolDefinition` type + `ScratchpadPlugin.tools?` / `.invokeTool?` added
- [x] Phase 5c: `packages/plugin-sdk/src/manifest.ts` — `PluginManifestSchema.tools?` added
- [x] Phase 5c: `lib/plugins/manifest-types.ts` — tools schema added, z.record fixed for Zod v4
- [x] Phase 5c: `app/api/chat/route.ts` — POST streaming endpoint, `convertToModelMessages()` + `toUIMessageStreamResponse()`
- [x] Phase 5c: `app/api/chat/tools/route.ts` — GET available tool names
- [x] Phase 5c: `app/(app)/chat/page.tsx` — useChat v6 hook, local input state, sendMessage/status API, parts-based rendering
- [x] Phase 5c: `components/app/chat/transcript.tsx` — AnimatePresence message list, `isStaticToolUIPart` / `isTextUIPart` filters
- [x] Phase 5c: `components/app/chat/composer.tsx` — auto-growing textarea, Enter-to-send, Shift+Enter for newline
- [x] Phase 5c: `components/app/chat/tool-call-block.tsx` — type-differentiated tool call renderers with v6 states
- [x] Phase 5c: sidebar + command palette — "Chat" nav item + "Open chat" in Cmd-K
- [x] Phase 5c: 18 unit tests (13 core tools + 5 plugin tools) — all passing
- [x] Phase 5c: `@ai-sdk/react@3.0.170` installed as new dependency

### Active decisions (promoted to ADRs)
- Default pack tokens in `@theme {}` (Tailwind-native); marketplace/custom packs compiled under `[data-theme="id"] {}` (selector scope)
- `ResolvedTheme.id` exposed in both union members so layout can set `data-theme` regardless of theme kind
- Theme registry served as static JSON from `public/theme-registry/` — no external service for v1
- **ADR-R15:** Hybrid plugin distribution — built-in plugins bundled, community plugins over HTTP, self-hosters can optionally bundle at build time
- **ADR-R16:** Blackout blocks replace blackout days — ranges, partial-day, recurrence support
- **ADR-R17:** Window templates — user-defined time intents, soft-ranked placement
- **ADR-R18:** Flexible recurrence — spawn-on-complete, per-instance edits, series deletion
- **ADR-R19:** Session-scoped chat — core + plugin tools, no persistence (softens ADR-R8)

### What's built (session 17 additions)
- [x] Beta gate: shared-password access control (`middleware.ts`, `/beta-gate` page, `/api/beta-gate` route, `betaGateAttempts` table, migration `0009`)
- [x] Resend email abstraction: `lib/email/` (client, send, VerificationEmail template), wired into Better Auth email verification hook
- [x] `no-resend-imports` ESLint rule; email templates exempted from `no-raw-colors`
- [x] `references/email-setup.md` — Resend + Cloudflare DNS setup docs

### Known issues / blockers
- Lighthouse perf score not yet measured (needs live deploy)
- `vercel.json` cron still set to daily at midnight UTC (hobby plan limitation)
- GitHub repo not yet set to public (manual step)
- `v1.0.0` tag not yet applied (pending deploy verification)
- 5c integration tests for "LLM tool calls produce real DB mutations" and "HTTP plugin tool invocation over HMAC" deferred (require live LLM mocking)
- 5b integration tests for "spawned instance field inheritance" and "GCal event cleanup on series delete" deferred (require DB-level test infrastructure)
- Beta gate + email env vars not yet set on Vercel (`BETA_PASSWORD`, `BETA_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`)

### Next concrete action
1. Deploy: `pnpm db:migrate` production (applies `0009_beta_gate_attempts.sql`)
2. Set `BETA_PASSWORD`, `BETA_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` on Vercel
3. Verify beta gate on live deploy
4. Manual verification of Phase 5c chat flow (live deploy)
5. `git tag v1.0.0 && git push origin v1.0.0`
6. Set GitHub repo to public

---

## Session log

Append new entries at the top. Use the template below.

---

## 2026-04-23 — Mobile-friendly dashboard + shadcn setup

**Goal:** Make all dashboard UI screens mobile-responsive; introduce shadcn components.

**Built:**
- Initialized shadcn (Tailwind v4 compatible) — `components.json`, `lib/utils.ts`, `@base-ui/react`, `lucide-react` added
- Added shadcn components: `sheet`, `button`, `badge`, `tabs`, `input`, `label`, `select`
- `components/app/mobile-nav.tsx` — mobile top bar (hamburger + logo) with `Sheet` left-side drawer containing full navigation + sign-out; visible only on `< md`
- `app/(app)/layout.tsx` — mounts `<MobileNav />` above page content; sidebar unchanged on desktop
- `components/app/sidebar.tsx` — `hidden md:flex` added to `<aside>` so it's desktop-only
- `app/(app)/tasks/page.tsx` — task card meta always visible on mobile (`hidden sm:flex` + compact deadline for xs); actions always shown on mobile (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`); modal `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; header/content padding responsive; filter tabs `overflow-x-auto`
- `app/(app)/dashboard/page.tsx` — deadline list items reflow to two-line layout (title + tags+date on second line) for narrow viewports; responsive padding
- `app/globals.css` — removed `--color-accent: var(--accent)` from shadcn `@theme inline` block to prevent overriding our brand indigo token

**Decisions made:**
- shadcn components styled by overriding `className` with our design tokens (e.g. `bg-surface border-wire` on SheetContent) — shadcn's own `:root` vars coexist but don't conflict
- Mobile sidebar: Sheet drawer pattern, not a bottom tab bar — consistent with desktop nav mental model
- Task actions (edit/delete) always visible on mobile; desktop hover-reveal preserved

**Tests:** 278/278 passing. `pnpm tsc --noEmit` clean. Build clean.

**Files touched:** 7 new/modified

**Next action:** Same as before — deploy migration + env vars + v1.0.0 tag

---

## 2026-04-20 — Session 17: Bug fixes + Beta gate + Resend email

**Goal for this session:** Fix GCal delete bug and React setState render error; implement beta-gate shared-password access control and Resend transactional email.

**Bug fixes:**
- `app/api/tasks/[id]/route.ts` — GCal deletion was fire-and-forget; Vercel tore down the function before the Promise resolved. Converted to awaited `Promise.all` for both instance and series delete paths. Also switched static `import { getWriteCalendarId }` to dynamic import to avoid eager DB initialisation breaking integration tests.
- `lib/hooks/use-calendar-drag.ts` — `onCreateEnd`/`onMoveEnd`/`onResizeEnd` callbacks were called inside `setDragState` updater functions, triggering "Cannot update a component while rendering a different component" React error. Fixed by tracking latest drag state in closure variables (`latestBlock`, `latestCreate`) and calling callbacks after `setDragState(null)` as separate statements.

**Beta gate (Part 1):**
- `lib/db/schema/beta-gate.ts` + `drizzle/0009_beta_gate_attempts.sql` — `betaGateAttempts` table for IP-based rate limiting
- `lib/beta-gate/index.ts` — HMAC-SHA256 JWT cookie (jose), 30-day expiry, `signBetaCookie` / `verifyBetaCookie`
- `middleware.ts` — Node.js middleware; public path list; redirect to `/beta-gate?next=<path>` when cookie invalid; `sanitizeNext` prevents open redirect
- `next.config.ts` — `experimental.nodeMiddleware: true`
- `app/api/beta-gate/route.ts` — POST handler: Zod parse, DB rate limit (10/IP/15 min), `crypto.timingSafeEqual` password compare, set HttpOnly cookie
- `app/(marketing)/beta-gate/page.tsx` + `BetaGateForm.tsx` — Server + Client Components for the gate UI
- `tests/unit/beta-gate.test.ts` — 5 unit tests for JWT sign/verify
- `tests/integration/beta-gate-api.test.ts` — 7 integration tests (200+cookie, 401, 400, 429, open-redirect sanitisation)

**Resend email (Part 2):**
- `lib/email/client.ts` — singleton Resend client; `KAIROS_MODE=self-hosted-no-email` bypass
- `lib/email/send.ts` — `sendEmail()` renders React template to HTML+text, never throws, returns `{ ok, id|error }`
- `lib/email/templates/VerificationEmail.tsx` — React Email dark-theme template
- `lib/auth/index.ts` — wired `emailVerification.sendVerificationEmail` hook to `sendEmail()`
- `eslint-rules/no-resend-imports.js` — bans `resend` imports outside `lib/email/`; exempts email templates from `no-raw-colors`
- `.env.example` + `references/email-setup.md` — Resend + Cloudflare DNS setup docs

**Test fixes (pre-existing breakage from earlier calendar/chat work this session):**
- `tests/integration/tasks.test.ts` — added db/schema/drizzle-orm/gcal mocks to `setupRouteModule` helper
- `tests/integration/chat.test.ts` — added `@/lib/services/ai-keys` mock (eager db import chain)
- `tests/unit/chat-router.test.ts` — added `@/lib/chat/gcal-tools` mock
- `tests/unit/chat-tools.test.ts` — `tagIds` → `tags` (schema renamed), added `listTasks` mock for duplicate-check path
- `tests/unit/scheduler/splitting.test.ts` — set `bufferMins: 0` on chunk-size tests (buffer-inclusive minRequired is intentional)

**Verification:** 278/278 tests pass. `pnpm tsc --noEmit` clean. ESLint 0 errors.

**Files touched:** ~25 new/modified

**ADRs promoted:** None new — beta gate and email are infrastructure, not architectural decisions.

**Next action:**
1. Deploy: run `pnpm db:migrate` on production to apply `0009_beta_gate_attempts.sql`
2. Set `BETA_PASSWORD`, `BETA_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` env vars on Vercel
3. Verify beta gate works on live deploy
4. Manual verification of Phase 5c chat flow (live deploy)
5. Tag `v1.0.0` when deploy verified

---

## 2026-04-18 — Session 16: Hardening pass — code fixes, lint clean, test coverage

**Goal for this session:** Fix all errors/inconsistencies found in codebase audit; complete remaining testable TODO.md items across 5b and 5c.

**Code fixes:**
- `lib/hooks/use-tasks.ts` — removed duplicate `useDeleteTaskSeries()` declaration (build-breaking)
- `components/app/chat/tool-call-block.tsx` — replaced raw `text-red-400` with semantic `text-danger`
- `app/(app)/chat/page.tsx` — removed unused `isToolUIPart` import
- `app/(app)/schedule/page.tsx` — escaped unescaped apostrophe (`won't` → `won&apos;t`)
- `components/app/quick-create-modal.tsx` — added targeted `eslint-disable` around GCal API color data (false positive for design-token rule)
- `lib/llm/index.ts` — added `isLLMConfigured()` export (checks provider + key presence)
- `app/api/chat/route.ts` — returns 400 when LLM provider is not configured
- `lib/chat/stream.ts` — exported `SYSTEM_PROMPT` constant (was private)
- `tests/integration/me-theme.test.ts` — fixed pre-existing db mock (missing `select` chain for themeInstalls lookup)

**Tests added:**
- `tests/unit/chat-tools.test.ts` — 11 new `inputSchema` validation tests (rejects invalid args, accepts valid)
- `tests/unit/chat-router.test.ts` (NEW) — 7 tests for `createAllTools`/`getAvailableToolNames` + 3 SYSTEM_PROMPT snapshot tests
- `tests/integration/chat.test.ts` (NEW) — 8 integration tests: auth, LLM-not-configured 400, empty messages 400, streaming response, GET /tools, no-chat-tables schema assertion
- `tests/unit/services/recurrence.test.ts` (NEW) — 4 unit tests for `resolveSeriesRoot` (root, child, missing, standalone)
- `tests/integration/tasks.test.ts` — 2 new tests: completing past count, completion enqueues schedule:single-task for spawned instance

**Verification:** 259/259 tests pass. `pnpm tsc --noEmit` clean. `pnpm lint` 0 errors, 4 pre-existing warnings only.

**Files touched:** 13 modified, 4 new

**Next action:**
1. Manual verification of Phase 5c chat flow (type queries, streaming, tool calls, copy transcript)
2. Deploy verification: `pnpm db:migrate` production, tag v1.0.0

---

## 2025-07-20 — Session 15: Slice 5b — Flexible Recurrence

**Goal for this session:** Implement Slice 5b — flexible recurrence with `mode: 'fixed' | 'after-complete'`, spawn-on-complete, per-instance/series deletion, complete route, and recurrence UI.

**Changes:**
- `lib/scheduler/types.ts` — added `mode?: 'fixed' | 'after-complete'` to `RecurrenceRule`
- `lib/scheduler/recurrence.ts` — added `nextOccurrenceAfterComplete(rule, completedAt)` pure function
- `lib/services/recurrence.ts` (NEW ~241 lines) — `resolveSeriesRoot`, `spawnNextOccurrence`, `deleteInstance`, `deleteSeries`
- `app/api/tasks/[id]/complete/route.ts` (NEW ~60 lines) — POST endpoint: auth → complete task → spawn next if recurring → enqueue schedule
- `app/api/tasks/[id]/route.ts` — DELETE handler updated: reads `?scope=instance|series`, dispatches to recurrence service
- `lib/hooks/use-tasks.ts` — added `useCompleteTask`, `useDeleteTaskSeries` hooks, `recurrenceRule` on `UpdateTaskInput`
- `lib/hooks/types.ts` — added `scheduledEnd`, `recurrenceIndex` fields to `Task`
- `components/app/task-edit-modal.tsx` — recurrence editor (mode/freq/interval toggle), series delete confirmation (instance vs whole series)
- `app/(app)/tasks/page.tsx` — `useCompleteTask` for markDone, ↻ glyph for recurring tasks
- `tests/unit/scheduler/recurrence.test.ts` — 9 new tests (22 total) for `nextOccurrenceAfterComplete` + back-compat
- `tests/integration/tasks.test.ts` — 9 new tests (22 total) for DELETE ?scope=series + POST complete endpoint

**Verification:** 204/205 tests pass (1 pre-existing `me-theme` mock issue), all new tests green.

**ADRs promoted:** ADR-R18 (Flexible recurrence) already in `references/architecture-decisions.md`.

---

## 2025-07-18 — Session 14: Phase 5a frontend completion + TODO.md update

**Goal for this session:** Complete remaining Slice 5a frontend (template management UI, blackouts section, preferred-template picker) and update TODO.md checkboxes.

**Changes:**
- `components/app/schedule-section.tsx` (NEW ~245 lines) — `TemplateEditor` (per-template day editor preserving cross-template windows), `TemplateCard` (expandable with rename/delete/set-default), `ScheduleSection` (template list with add button, auto-creates default)
- `components/app/blackouts-section.tsx` (NEW ~180 lines) — `BlackoutForm` (datetime-local + recurrence), `BlackoutRow` (display with edit/delete), `BlackoutsSection` (CRUD list)
- `app/(app)/settings/page.tsx` (REDUCED ~535→~250 lines) — extracted schedule + blackout components, replaced inline code with `<ScheduleSection />` and `<BlackoutsSection />`
- `components/app/task-edit-modal.tsx` — added `preferredTemplateId` state + template dropdown (conditional on schedulable + templates exist)
- `lib/hooks/use-tasks.ts` — added `preferredTemplateId?: string | null` to `CreateTaskInput` + `UpdateTaskInput`
- Fixed lint warning in `schedule-section.tsx` (ternary → if/else for `toggleCopyTarget`)
- Updated `TODO.md` — checked off all completed Slice 5a Build, Test, and Definition of Done items

**Verification:** 186/187 tests pass (1 pre-existing `me-theme` mock issue), typecheck clean, lint clean (only pre-existing `no-raw-colors` in theme files).

## 2025-07-17 — Session 13: Phase 5a implementation

**Goal for this session:** Implement Slice 5a — blackout blocks, window templates, scheduler integration, services, API routes, hooks, settings UI, tests.

**Changes:**
- `lib/db/schema/schedule.ts` — removed `blackoutDays`, added `windowTemplates` + `blackoutBlocks` tables, added `templateId` FK on `scheduleWindows`
- `lib/db/schema/tasks.ts` — added `preferredTemplateId` FK
- `drizzle/0006_schedule_types.sql` — migration for all schema changes
- `lib/scheduler/types.ts` — `BlackoutBlock`, `WindowTemplate` types, `templateId` on `ScheduleWindow`/`TimeSlot`
- `lib/scheduler/slots.ts` — `BlackoutBlock[]` param, `expandBlackouts()` with recurrence, templateId propagation
- `lib/scheduler/placement.ts` — `rankSlotsForTask()` for preferred-template ranking
- `lib/scheduler/runner.ts` — loads new entities, threads through pipeline (287 lines — over soft cap, acceptable for orchestrator)
- `lib/services/blackouts.ts` — full CRUD
- `lib/services/window-templates.ts` — full CRUD + `ensureDefaultTemplate()` with delete protection + default uniqueness
- `lib/services/schedule-windows.ts` — `templateId` on `WindowInput`
- `lib/services/tasks.ts` — `preferredTemplateId` on create/update inputs
- `app/api/blackouts/` — 2 route files (collection + item)
- `app/api/window-templates/` — 2 route files (collection + item)
- `app/api/schedule-windows/route.ts` — `templateId` in Zod schema
- `app/api/tasks/route.ts` + `app/api/tasks/[id]/route.ts` — `preferredTemplateId` in schemas
- `lib/hooks/use-blackouts.ts` + `lib/hooks/use-window-templates.ts` — TanStack Query hooks
- `lib/hooks/types.ts` — new interfaces + `preferredTemplateId` on `Task`
- `app/(app)/settings/page.tsx` — auto-create default template, thread `templateId` through editor
- 5 test files updated (makeTask + new assertions), 2 new integration test files

**Test results:** 186 pass, 1 pre-existing failure (`me-theme.test.ts` db mock issue). Typecheck clean. Lint clean (only pre-existing `no-raw-colors` errors).

**Decisions:** None new — all aligned with ADR-R16 (blackout blocks) and ADR-R17 (window templates).

**Next:** Slice 5b (flexible recurrence) or Slice 5c (session-scoped chat).

---

## 2025-04-18 — Session 12: Phase 5 planning

**Goal for this session:** Document Phase 5 scope — blackout blocks, window templates, flexible recurrence, session-scoped chat.

**Changes:**
- `TODO.md` — added full Phase 5 section (slices 5a/5b/5c) with Build, Test, Verify, and Definition of Done checklists per slice, plus cross-slice verification and explicit not-in-scope list. Updated "Not in v1" to note chat moved to Phase 5c.
- `references/architecture-decisions.md` — added ADR-R16 (blackout blocks), ADR-R17 (window templates), ADR-R18 (flexible recurrence), ADR-R19 (session-scoped chat). Updated phase scope reference to include Phase 5.
- `CHANGELOG.md` — updated current state, active decisions, and next action to reflect Phase 5 planning.

**Decisions locked:**
- ADR-R16: `blackoutBlocks` replaces `blackoutDays` — ranges, partial-day, recurrence
- ADR-R17: Window templates with soft-ranked placement (preferred template wins if free, any slot otherwise)
- ADR-R18: Spawn-on-complete recurrence, `parentTaskId` as series root, `?scope=instance|series` on delete
- ADR-R19: Session-scoped chat over `lib/llm/`, no `chatSessions`/`chatMessages` tables, core + plugin tools

**Next action:** Start Slice 5a — migration `0006_schedule_types.sql`, then scheduler changes, then CRUD services + routes.

---

## 2025-07-25 — Session 11: Phase 4b completion

**Goal for this session:** Complete all Phase 4b checklist items — plugin marketplace infrastructure.

**Built:**
- `packages/plugin-sdk/src/manifest.ts` — `PluginManifestSchema` Zod schema with distribution refinements
- `lib/plugins/manifest-types.ts` — in-lib re-export for use without SDK dependency
- `lib/plugins/safety.ts` — safety checks: size limit, ID collisions, HTTPS enforcement, DNS rebinding protection, format validation
- `lib/plugins/install.ts` — `installPluginManifest()`, `installPluginFromUrl()`, `uninstallPlugin()`, `listInstalledPlugins()`, `rollbackPlugin()`
- `lib/plugins/http-adapter.ts` — wraps remote HTTP plugins as `ScratchpadPlugin` with circuit breaker (3 failures/1min → 5min open), HMAC request signing, 5s timeout
- `lib/plugins/updates.ts` — `checkForUpdates()` compares installed versions against registry
- Updated `lib/plugins/host.ts` — `loadHttpPlugins()`, `listAllPlugins()`, dispatch tries bundled then HTTP
- `app/api/plugins/install/route.ts` — POST (discriminated union: URL or raw manifest)
- `app/api/plugins/[name]/uninstall/route.ts` — DELETE
- `drizzle/0004_plugin_install_fields.sql` — adds manifestJson, previousVersion, previousManifestJson, endpoint, endpointSecret, lastHealthyAt to pluginInstalls
- `public/plugin-registry/` — 10 plugins: instagram, twitter, readwise, voice, github, notion, linear, email, slack, todoist
- `packages/validator-core/` — shared validation primitives (types, fs, output formatters)
- `packages/plugin-validator/` — CLI for validating plugin manifests
- `packages/theme-validator/` — CLI for validating theme manifests
- `.github/workflows/validate-registry.yml` — CI validates all manifests on PR/push
- Updated marketplace UI — plugins tab now has full browse/search/install/uninstall/toggle UX
- Updated `lib/hooks/use-plugins.ts` — `usePluginRegistry()`, `useInstallPlugin()`, `useUninstallPlugin()`, `usePluginUpdates()`
- Updated `CONTRIBUTING.md` — plugin development section (create, validate, submit)

**Decisions made:**
- ADR-R15 fully implemented — hybrid distribution locked
- Plugin registry is flat-file JSON in `public/` (same pattern as theme registry)
- HTTP adapter uses HMAC signing with per-install secret + circuit breaker
- Validator CLIs share `@kairos/validator-core` for output formatting and file I/O

**Files touched:** ~35 new/modified

**Tests added:** 0 (existing tests unaffected)

**Next action:**
1. `pnpm install` + `pnpm db:migrate` on production
2. Set GitHub repo to public
3. `git tag v1.0.0 && git push origin v1.0.0`

---

## 2026-04-18 — Session 10: Phase 3 + 4 completion

**Goal for this session:** Complete all remaining Phase 3 and Phase 4 todos.

**Built:**
- `packages/plugin-sdk/` — `@kairos/plugin-sdk` package: types, `definePlugin()`, `createParseResult()`, `createMockContext()` for tests
- `examples/plugins/` — 4 reference plugins: `kairos-plugin-instagram`, `kairos-plugin-twitter`, `kairos-plugin-readwise`, `kairos-plugin-voice`
- `app/(marketing)/docs/` — docs layout + 4 pages: overview, plugin guide, theme authoring guide, API reference
- `lib/db/schema/themes.ts` + `drizzle/0003_theme_installs.sql` — `themeInstalls` table (userId, themeId unique, source, manifestJson, compiledCss)
- `lib/themes/safety.ts` — CSS injection scan, font allowlist, size limit, ID uniqueness
- `lib/themes/install.ts` — `installManifest()`, `installFromRegistryUrl()`, `uninstallTheme()`, `listInstalledThemes()`
- Updated `lib/themes/compile.ts` — `scope: '@theme' | 'selector'` param (default `'@theme'`; all snapshot tests still pass)
- Updated `lib/themes/runtime.ts` — resolves marketplace installs; type now `{ kind: 'marketplace'; id: string; cssUrl: string }`
- `app/api/themes/install/route.ts` — POST (registry URL or raw manifest, discriminated union body)
- `app/api/themes/[installId]/route.ts` — DELETE (uninstall)
- `app/api/themes/[installId]/css/route.ts` — GET (serve compiled CSS, 1yr immutable cache)
- `app/api/themes/installed/route.ts` — GET (list user's installed themes)
- `public/theme-registry/index.json` + `manifests/` — 5 community themes: nord-dark, dracula, catppuccin-mocha, solarized-light, tokyo-night
- `lib/hooks/use-themes.ts` — `useInstalledThemes`, `useThemeRegistry`, `useInstallTheme`, `useInstallCustomTheme`, `useUninstallTheme`
- `app/(app)/settings/marketplace/page.tsx` — tabbed Plugins | Themes marketplace with preview cards, search, scheme filter
- `app/(app)/settings/appearance/custom/page.tsx` — JSON manifest paste → validate + install → auto-activate
- Updated `app/(app)/settings/appearance/page.tsx` — installed marketplace themes appear in picker; links to marketplace and custom upload
- Updated `components/app/sidebar.tsx` — Marketplace nav item added
- Updated `app/layout.tsx` — injects `<link rel="stylesheet">` for marketplace themes (FOUC-free)
- Updated `tsconfig.json` — excludes `examples/` and `packages/` (standalone packages with own tsconfigs)
- Updated `eslint-rules/no-raw-colors.js` — docs and custom upload paths added to allowlist

**Decisions made:**
- Marketplace/custom packs compiled with `scope: 'selector'` → `[data-theme="id"] {}` — separate from Tailwind's `@theme {}`
- `ResolvedTheme` includes `id` in both union members so `app/layout.tsx` can always set `data-theme`
- Theme registry is static JSON in `public/` — no external service needed for v1 (per ADR-R14 flat-file approach)

**Files touched:** ~45 new/modified

**Tests added:** 0 (all 157 existing pass)

**Next action:**
1. `pnpm db:migrate` on production (applies `0003_theme_installs.sql`)
2. Set GitHub repo to public
3. `git tag v1.0.0 && git push origin v1.0.0`

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
