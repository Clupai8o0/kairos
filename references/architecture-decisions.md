# Architecture Decisions Record (ADR) — Kairos

This file is the single authoritative source for locked architectural decisions in Kairos. Decisions here are final unless explicitly overridden. Claude should not re-litigate them. New mid-session decisions get promoted from `CHANGELOG.md` into a new `ADR-Rn` here.

This supersedes the old `kairos-api/references/architecture-decisions.md` entirely. The Python-stack ADRs from that file are obsolete; the principles they encoded are restated below in stack-neutral form where they still apply.

---

## Foundational decisions

### ADR-001: Single Next.js application
**Decision:** Frontend, API routes, background jobs, and the landing page all live in one Next.js 16 app with the App Router.
**Consequences:** No separate backend service. No separate landing page repo. Route groups (`(marketing)` and `(app)`) handle the marketing/app split inside one codebase.

### ADR-002: PostgreSQL only
**Decision:** Postgres 16 via Neon. No Redis, no Mongo, no SQLite outside tests.
**Consequences:** JSONB handles flexible metadata. SQLite only as a test convenience if needed.

### ADR-003: Google Calendar is the source of truth for time
**Decision:** Tasks store `gcalEventId` and a denormalised `scheduledAt` cache. No time blocks in the DB.
**Consequences:** If GCal is unreachable, the task is created with `scheduledAt = null` and a job retries. Never block task creation on external availability.

### ADR-004: Tags-only taxonomy
**Decision:** No projects, folders, areas, contexts, or types. Tags are the universal organiser.
**Consequences:** Schema-enforced (ADR-R7). Every old "project" concept becomes one or more tags.

### ADR-005: Schedule-on-write, single-task placement
**Decision:** Creating or updating a schedulable task triggers automatic placement of that one task. Full re-optimisation is explicit (cron or user action), broken into chunked jobs.
**Consequences:** The on-write path completes in 1-3s, fitting in a Vercel function. Long-running operations go through the `jobs` table (ADR-R9).

### ADR-006: Single-user v1
**Decision:** One user (Sam). Multi-user is post-v1.
**Consequences:** Auth simplified accordingly. Better Auth with Google OAuth handles both app login and GCal scope grant.

### ADR-007: API-first, no HTML responses
**Decision:** Bearer tokens only (Better Auth session cookies for browsers, API keys for headless agents). Every endpoint usable by frontend, agents, n8n, CLI.

### ADR-008: Monolith
**Decision:** Single Next.js process. Clean module boundaries inside the process. No microservices.

---

## Rewrite-specific ADRs

### ADR-R1: Pipeline-based scheduler
**Decision:** The scheduler is a pipeline of pure TypeScript functions in `lib/scheduler/`, not a single file.
**Context:** The old `services/scheduler.py` reached 973 lines.
**Consequences:**
```
lib/scheduler/
├── candidates.ts    # which tasks need scheduling right now
├── urgency.ts       # pure scoring, no IO
├── slots.ts         # free slot computation
├── placement.ts     # which slot a task goes into
├── splitting.ts     # break long tasks into chunks
├── recurrence.ts    # generate occurrence dates
└── runner.ts        # orchestrator — only file that touches DB + GCal
```
- Every file except `runner.ts` is pure
- Unit tests target individual modules without DB or HTTP mocks
- `runner.ts` is thin

### ADR-R2: GCal is a directory of small modules
**Decision:** GCal integration lives in `lib/gcal/` with separate submodules.
**Context:** The old `gcal_service.py` was 1051 lines in a single class.
**Consequences:**
```
lib/gcal/
├── auth.ts          # OAuth + token refresh
├── calendars.ts     # list / select connected calendars
├── freebusy.ts      # free/busy queries with caching
├── events.ts        # event CRUD
└── errors.ts        # GoogleApi error → domain error mapping
```
No file over ~250 lines. Route handlers and services never import directly from `googleapis` — always via `lib/gcal/*`.

### ADR-R3: Plugin host pattern for the scratchpad
**Decision:** The scratchpad service is a plugin host. It defines a `ScratchpadPlugin` interface and dispatches input to whichever plugin claims it.
**Context:** The old `scratchpad_service.py` hardcoded an extraction prompt and an OpenAI call inline.
**Consequences:**
- `lib/plugins/host.ts` — loader, registry, dispatcher
- `lib/plugins/types.ts` — interface definitions, Zod schemas
- `lib/plugins/context.ts` — `PluginContext` implementation
- `lib/plugins/builtin/text-to-tasks/` — the one bundled plugin
- All other plugins are external (npm/HTTP — phase 4 decision)

### ADR-R4: Per-plugin custom memory and rulesets
**Decision:** Every plugin gets user-scoped config, memory, and rulesets through `PluginContext`. Part of the contract, not bolted on.
**Consequences:**
- Drizzle table: `scratchpadPluginConfigs(userId, pluginName, config, memory, rulesets)`
- `PluginContext.getMemory()/setMemory()/updateMemory()` for plugin-managed state
- `PluginContext.getRulesets()` for user-defined rules
- Rulesets evaluated by the plugin during `parse()`, after the LLM call but before returning

### ADR-R5: Design system is a swappable token pack with hybrid packaging
**Decision:** Multiple design "packs" (full visual identities) shipped with two packaging formats — built-ins as CSS files in the repo, marketplace packs as JSON manifests compiled to CSS at install. Both satisfy the same token contract.
**Context:** The original ADR-R5 left packaging open. With the marketplace landing in phase 4 (ADR-R14), the format needs to be locked. CSS-only loses install-without-redeploy for community packs. JSON-only loses build-time type safety for first-party packs. Hybrid keeps both wins.
**Consequences:**
- Built-in packs live at `app/styles/packs/<id>.css` and are statically registered in `app/styles/packs/manifest.ts`
- Marketplace packs are JSON manifests validated by `ThemeManifestSchema` (Zod), compiled to CSS at install time, stored in `themeInstalls.compiledCss`, and served from `app/api/themes/[id]/css/route.ts`
- The token contract is identical for both formats — see `references/theme-system.md` for the required token list
- Components reference semantic tokens only (`bg-surface`, `fg-default`, etc.) — never raw Tailwind colours, never hex values. Enforced via the `no-raw-colors` ESLint rule shipped in phase 2.
- Active theme persisted as `users.activeThemeId` (text, default `obsidian-linear`). No new tables in phase 2; `themeInstalls` table arrives in phase 4 with the marketplace.
- Plugins may declare a theme dependency in their manifest. Installing the plugin makes the pack available; the user still chooses whether to activate it.

Full spec: `references/theme-system.md`. Marketplace: `references/theme-marketplace.md`.

### ADR-R6: Frontend scope shrinks for v1
**Decision:** v1 routes: dashboard, tasks, schedule, scratchpad, tags, views, settings. **No chat, no voice in v1.**

### ADR-R7: No `projectId` on Task — schema-enforced
**Decision:** The `tasks` table has no `projectId`. There is no `projects` table. There is no `/api/projects` route.
**Context:** ADR-004 said "no projects" in the original build but the code disagreed.
**Consequences:**
- ESLint custom rule + grep CI check fail the build if `Project`, `projectId`, or `projects` appear as domain identifiers
- The scratchpad's builtin plugin extracts `tags: string[]`, never `projectName`

### ADR-R8: ChatSession is post-v1
**Decision:** No `chatSessions` table, no chat service, no `/api/chat` routes in v1.
**Consequences:** If chat returns, it returns as a plugin or v2 feature.

### ADR-R9: Background work via Vercel Cron + Postgres `jobs` table
**Decision:** No separate worker process. Vercel Cron triggers `app/api/cron/drain/route.ts` which processes due jobs from a Postgres-backed `jobs` table.
**Consequences:**
- `jobs` table with `id`, `type`, `payload`, `status`, `runAfter`, `attempts`, `lastError`, `idempotencyKey`
- Each job invocation must complete in <10s (Vercel Hobby) — long operations decompose into smaller jobs that enqueue follow-ups
- Idempotency via unique partial index on `idempotencyKey`
- No Redis, no BullMQ, no separate worker

### ADR-R10: Zero LLM provider SDKs in core
**Decision:** Direct provider imports (`openai`, `@anthropic-ai/sdk`, etc.) only allowed inside `lib/llm/` and inside specific bundled plugin packages. Everywhere else uses `PluginContext.complete()` / `completeStructured()`, which routes through the Vercel AI SDK to the user's configured provider.
**Consequences:**
- Root `package.json` lists `ai` (the abstraction) but no provider-specific packages — those are runtime-installed based on user config, or shipped only by plugins that need them
- ESLint custom rule fails the build on disallowed provider imports
- **Raw colour literals outside theme pack files** — banned in components, JSX, and CSS Module files. Allowed paths: `app/styles/packs/`, `lib/themes/compiled/`. Rule: `eslint-rules/no-raw-colors.js`. See `references/theme-system.md` for the rule definition.

### ADR-R11: Auth via Better Auth, not Clerk
**Decision:** Better Auth (TypeScript-native, self-hostable, stores users in your own Postgres) replaces Clerk.
**Context:** Clerk is paid SaaS — every self-hoster would have to sign up before `docker compose up` works, killing the "5 minute self-host" promise.
**Consequences:**
- Single Google OAuth flow handles both app login and GCal scope grant
- Sessions stored in Postgres via Better Auth's Drizzle adapter
- API key auth lives alongside session auth, same system
- Self-hosters configure their own Google OAuth credentials in `.env`, no third-party dependency

### ADR-R12: Hosted/self-hosted mode is a single env var
**Decision:** `KAIROS_MODE=self-hosted` (default) vs `KAIROS_MODE=hosted` controls whether billing/rate-limit middleware is loaded. No `if (HOSTED)` branches scattered through services.
**Consequences:**
- `lib/billing/` package only imported when `KAIROS_MODE=hosted`
- Self-hosters never see Stripe code, never see rate-limit middleware
- Hosted mode adds: rate limits per user, optional managed LLM allowance, Stripe integration
- The OSS install stays clean

### ADR-R13: Landing page lives in the same Next.js app
**Decision:** Marketing pages and app pages share one codebase using route groups: `app/(marketing)/` for landing/docs, `app/(app)/` for the authenticated app.
**Consequences:**
- One repo, one deploy, one design system import, one auth context
- Marketing routes are statically rendered (Next.js detects automatically); app routes are dynamic
- Splitting into two repos later is a one-day job if the constraint ever appears

### ADR-R14: Theme marketplace ships in phase 4, sharing infrastructure with the plugin marketplace
**Decision:** Community themes distribute via the same registry-and-PR model as plugins, with one in-app browser UI that has a Plugins tab and a Themes tab. The registry is a public GitHub repo (`kairos-themes-registry`) with a flat `manifests/` directory and an `index.json` index file.
**Context:** Originally the design system roadmap was vague about whether community themes were even in scope. The marketplace decision in phase 4 needs an explicit design — and the obvious lever is reusing the plugin marketplace's submission, validation, and discovery infrastructure rather than building a parallel system.
**Consequences:**
- One marketplace UI, two tabs. Same install endpoint pattern, same submission flow.
- `themeInstalls` table added in phase 4 (not phase 2). Phase 2 only needs `users.activeThemeId` to support built-in pack switching.
- Self-hosted and hosted instances both support marketplace browsing and install. Only difference: hosted instance reports anonymous install counts; self-hosted does not.
- Registry repo is decoupled from the main Kairos repo — community contributors don't need write access to Kairos itself to ship a theme.
- No payments, no premium themes, no revenue split. Same OSS posture as plugins.
- If the flat-file registry hits scale issues (hundreds of themes), the migration path is to a database-backed registry service. Defer until that's a real problem.

Full spec: `references/theme-marketplace.md`.

---

## Phase scope reference

These are not ADRs — they're the v1 boundary. Anything outside this list is not built in v1.

**v1 (phases 1 + 2):**
- Tasks, tags, views, schedule windows, blackout days, GCal integration, schedule-on-write
- Scratchpad as a plugin host with one bundled plugin (`text-to-tasks`)
- Frontend routes: dashboard, tasks, schedule, scratchpad, tags, views, settings
- Marketing route group with placeholder landing page
- Multiple swappable design packs with hybrid packaging (CSS for built-ins, JSON manifests for marketplace); token contract codified, ESLint `no-raw-colors` rule enforced
- Background jobs via Vercel Cron + Postgres `jobs` table
- Better Auth with Google OAuth

**Not in v1:**
- Chat / `chatSessions` / chat routes — **moved to Phase 5c** (session-scoped, no persistence; ADR-R19)
- Voice (returns as a plugin in phase 3)
- Multi-user (single-user only in v1)
- Plugin marketplace UI (phase 4)
- Stripe / paid tier (post-v1)
- Direct LLM provider SDKs anywhere outside `lib/llm/` and bundled plugins

**Phase 3:** open source — public repo, license, landing page filled in, plugin SDK, three example plugins, theme token contract documented for contributors.
**Phase 4:** in-app plugin + theme marketplace (shared UI, shared registry model). See ADR-R14.
**Phase 4b:** plugin marketplace completion — registry, install flow, HTTP runtime, signing, versioning, validator CLIs. See ADR-R15.
**Phase 5:** scheduling completion (blackout blocks ADR-R16, window templates ADR-R17), flexible recurrence (ADR-R18), session-scoped chat (ADR-R19). Ships in three slices (5a → 5b → 5c).

---

### ADR-R15: Hybrid plugin distribution (bundled + HTTP)
**Decision:** Built-in plugins (`text-to-tasks`) ship bundled at build time. Community plugins default to HTTP — plugin authors deploy their own serverless functions, Kairos calls them over a standardised contract (`GET /manifest`, `POST /parse`). Self-hosters can optionally bundle community plugins at build time via config for zero-latency parsing.
**Context:** ADR-R3 left the distribution model open ("npm/HTTP — phase 4 decision"). Three options were evaluated:
1. **npm-installed + redeploy** — type-safe but incompatible with hosted multi-tenant (every user install requires a redeploy).
2. **HTTP-only** — install without redeploy, but +200-500ms latency per parse and cold-start issues.
3. **Hybrid** — HTTP-first for hosted/marketplace, bundled path available for self-hosters who want zero latency.
**Consequences:**
- `lib/plugins/http-adapter.ts` wraps a remote plugin URL as a `ScratchpadPlugin` (implements `canHandle` + `parse` by calling the remote endpoint)
- HTTP plugin contract: `POST /parse` with `ScratchpadInput` body, returns `ParseResult`; `GET /manifest` returns `PluginManifest`
- Request signing: HMAC with per-(user, plugin) secret; 5s timeout; circuit breaker after 3 failures in 1 minute
- Bundled path is what already exists for `text-to-tasks` — no new code, just documentation
- Plugin registry at `public/plugin-registry/` (flat-file, mirroring theme registry) with CI validation
- `pluginInstalls` schema extended with `manifestJson`, `previousVersion`, `previousManifestJson`, `endpoint`, `lastHealthyAt` for HTTP health tracking and single-step rollback
- Signing optional in v1 (Sigstore provenance via npm `--provenance`), may become required in v2
- Full spec: `docs/superpowers/plans/13-plugin-marketplace.md`

### ADR-R16: Blackout days replaced by blackout blocks with ranges and recurrence
**Decision:** Replace the `blackoutDays` schema with `blackoutBlocks`. Each block has a start and end datetime (both `timestamptz`), an optional recurrence rule reusing `RecurrenceRule` from the scheduler, and an optional reason. Single-day all-day blocks are represented as `start = 00:00, end = 23:59:59` on the same date.
**Context:** The existing `blackoutDays` schema stores a single date and can't express "vacation June 3-10" or "block 2-5pm every Tuesday" — both requested.
**Consequences:**
- Migration drops `blackout_days`, creates `blackout_blocks` with the new shape. No production data preserved (v1 never shipped blackouts to users).
- `lib/scheduler/slots.ts` gets a `blackoutBlocks` parameter replacing `blackoutDates: Date[]`. Signature breaks, callers in `runner.ts` update in the same PR.
- Free-slot computation subtracts each concrete blackout interval in the lookahead window, including recurrence expansions via `generateOccurrences`.
- Old `blackoutDates` shape dies. No back-compat shim.

### ADR-R17: Window templates, not per-window types
**Decision:** Schedule windows are grouped into user-defined templates. Each template names a time intent ("Deep work", "Admin", "Personal"). Tasks get an optional `preferredTemplateId`. Placement is soft-ranked: when multiple free slots fit, the one inside the task's preferred template wins; otherwise any free slot wins.
**Context:** Four options were considered — string tags on windows, strict enums, fully user-defined types, templates. Templates won because they match how users think about time ("my deep-work hours"), preserve the existing flat-window schema with a single new FK column, and keep placement as a soft ranking (never a hard constraint that leaves a task unscheduled).
**Consequences:**
- New table `windowTemplates(id, userId, name, description, color, isDefault, createdAt, updatedAt)`.
- `scheduleWindows` gets `templateId: text references windowTemplates.id on delete cascade`. Existing windows on migration go into a seeded "Default" template per user.
- `tasks` gets `preferredTemplateId: text references windowTemplates.id on delete set null`.
- `lib/scheduler/placement.ts` adds a `rank(slot, task, templates)` pass before picking. Purely additive — no existing test changes semantics.
- API: `GET/POST/PATCH/DELETE /api/window-templates`. Schedule windows API takes `templateId` on write.

### ADR-R18: Flexible recurrence with spawn-on-complete and per-instance edits
**Decision:** Recurrence supports two modes on the `RecurrenceRule` type: `mode: 'fixed'` (current behaviour — occurrences on calendar dates regardless of completion) and `mode: 'after-complete'` (next occurrence scheduled N units after the previous one is marked done). Completing a recurring task spawns the next instance by creating a new task row with `parentTaskId = this.id`. The completed task stays in history; the new task inherits metadata. Users can delete a single instance or the whole series.
**Context:** The old Python build had a "replace previous cycle with current cycle" model. That's lossy — completed instances have value as history and for analytics. Spawn-on-complete preserves the chain (via `parentTaskId`) without destroying history.
**Consequences:**
- `RecurrenceRule` adds `mode: 'fixed' | 'after-complete'` (default `'fixed'` for back-compat).
- `after-complete` rules use `interval` + `freq`. At completion time, `next.scheduledAt = completedAt + interval * unit`.
- New service function `spawnNextOccurrence(taskId, completedAt)` — computes next time, returns a `NewTask` row; the service writes it and enqueues a placement job.
- `parentTaskId` is the series root. Direct children point to it, not the previous instance. "Delete series" is `WHERE parentTaskId = :root OR id = :root`.
- Task DELETE takes optional `?scope=instance|series` (default `instance`). `series` requires a parent or child of a series.
- Integration test coverage mandatory — first change in v1+ that creates DB rows as a side effect of completion.

### ADR-R19: Chat is session-scoped with core + plugin tool surface
**Decision:** A new surface at `app/(app)/chat/` and `app/api/chat/*` implements a general LLM sidekick. Messages are held in browser state and server memory for the request duration, not persisted. Tools available to the model: a fixed set of core tools (task CRUD, schedule query, tag/window/template operations) plus any plugin-exposed tools.
**Context:** ADR-R8 deferred chat entirely; it's now the right time. Persistence was the right thing to defer — session-scoped chat avoids `chatSessions`/`chatMessages` tables, avoids a search surface, and avoids privacy concerns.
**Consequences:**
- **ADR-R8 is softened, not reversed.** No `chatSessions` table. No `chatMessages` table. History is export-only (clipboard/markdown).
- `lib/chat/` directory: `tools.ts` (core tool catalogue), `plugin-tools.ts` (plugin tool aggregator), `router.ts` (tool-call dispatcher), `stream.ts` (Vercel AI SDK `streamText` wrapper).
- Plugin manifest schema gets optional `tools: ToolDefinition[]`. Plugin interface gets optional `invokeTool`. Existing plugins stay valid.
- Chat UI is a single `/chat` route with a transcript pane + input. Command palette gets "Open chat" entry.
- Tool execution permissions: core tools always available; plugin tools require the plugin to be installed and enabled.
- No streaming to persistence. No retrieval of prior chats.
