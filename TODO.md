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
- [ ] Plugin submission flow for community contributors (PR to registry) — Phase 4b
- [ ] Plugin signing and basic safety review (manual at first) — Phase 4b
- [ ] Version management: update notifications, changelogs, rollback — Phase 4b
- [x] **Theme marketplace** — see `references/theme-marketplace.md` for the full spec
- [x] `kairos-themes-registry` equivalent: `public/theme-registry/` with `index.json` and `manifests/` directory
- [x] `themeInstalls` Drizzle schema + migration
- [x] `lib/themes/install.ts` — fetch + validate + compile + insert flow
- [x] `lib/themes/safety.ts` — manifest safety checks (size, CSS injection, font allowlist)
- [x] `app/api/themes/install/route.ts` — install endpoint
- [x] `app/api/themes/[installId]/css/route.ts` — serves compiled CSS with cache headers
- [ ] `@kairos/theme-validator` CLI for local validation before submission — Phase 4b
- [x] In-app marketplace browser at `app/(app)/settings/marketplace/page.tsx` — Plugins and Themes tabs sharing the same UI shell
- [x] Custom theme upload at `app/(app)/settings/appearance/custom/page.tsx` (paste a manifest, validate, install with `source = 'custom-upload'`)

### Definition of done

- [ ] User installs a plugin from inside the app without leaving it — Phase 4b
- [ ] Plugin authors can submit via PR to the registry — Phase 4b
- [ ] At least 10 plugins in the registry — Phase 4b
- [x] User installs a theme from the in-app marketplace without leaving the app
- [x] User uploads a custom manifest and it installs as a usable theme
- [ ] Plugin authors can ship a theme as part of their plugin manifest — Phase 4b
- [x] At least 5 themes in the registry on launch (5 in `public/theme-registry/manifests/`)
- [ ] CI in the registry validates submitted manifests automatically — Phase 4b

---

## Phase 4b — Plugin marketplace completion

**Goal:** Close the gap between the theme marketplace (fully shipped) and the plugin marketplace (stub only). Finish what Phase 4 promised. Does not add features — finishes existing scope.

**Distribution model:** ADR-R15 (hybrid). Built-in plugins bundled; community plugins over HTTP; self-hosters can optionally bundle at build time.

Full specs: `docs/superpowers/plans/12-phase-4b-completion.md`, `13-plugin-marketplace.md`, `14-plugin-validator-cli.md`.

### Registry
- [ ] `public/plugin-registry/index.json` + `manifests/` (mirror theme registry structure)
- [ ] Plugin manifest schema (`PluginManifestSchema` in Zod, in `packages/plugin-sdk/src/manifest.ts`)
- [ ] Submission docs in `CONTRIBUTING.md`
- [ ] CI workflow in `.github/workflows/validate-plugin-registry.yml`

### Install flow
- [ ] `lib/plugins/install.ts` — `installFromRegistryUrl()`, `uninstallPlugin()`, `listInstalledPlugins()`
- [ ] `lib/plugins/safety.ts` — manifest safety checks (size, URL allowlist, signature verification)
- [ ] `app/api/plugins/install/route.ts` — POST
- [ ] `app/api/plugins/[installId]/route.ts` — DELETE (uninstall)
- [ ] `app/api/plugins/registry/route.ts` — GET (proxy for registry index with TTL caching)
- [ ] `lib/hooks/use-plugins.ts` — add `useInstallPlugin`, `useUninstallPlugin`, `usePluginRegistry`

### HTTP plugin runtime
- [ ] `lib/plugins/http-adapter.ts` — wraps remote plugin URL as `ScratchpadPlugin`
- [ ] HTTP contract: `POST /parse`, `GET /manifest`
- [ ] HMAC request signing (per-user, per-plugin secret)
- [ ] Timeout (5s), circuit breaker (3 failures / 1 min)

### Marketplace UI
- [ ] Extend Plugins tab with registry-backed cards (Install / Uninstall / Configure)
- [ ] Install count + "Update available" badge
- [ ] Configure button for installed plugins (generic settings from `configSchema`)

### Signing
- [ ] Opt-in `provenance` field in `PluginManifest` (Sigstore bundle)
- [ ] `lib/plugins/safety.ts` verifies bundle if present; absence = warning, not block
- [ ] At least one plugin ships with provenance

### Version management
- [ ] `lib/plugins/updates.ts` — compare installed vs registry version
- [ ] `GET /api/plugins/updates` route
- [ ] Update button in UI — preserves config + memory + rulesets
- [ ] Changelog display from manifest
- [ ] Rollback — swap `version` ↔ `previousVersion`

### Validator CLIs
- [ ] `packages/validator-core/` — shared I/O, formatting, exit codes (private package)
- [ ] `packages/plugin-validator/` — `@kairos/plugin-validator` (npx-callable)
- [ ] `packages/theme-validator/` — `@kairos/theme-validator` (npx-callable)
- [ ] Invoked in registry CI on every PR

### Plugin-shipped themes
- [ ] `PluginManifest.theme?: ThemeManifest` optional field
- [ ] Plugin install handler calls `installManifest()` with `source: 'plugin'` when theme present
- [ ] Uninstalling plugin uninstalls the theme

### Schema changes
- [ ] `pluginInstalls` migration: add `manifestJson`, `previousVersion`, `previousManifestJson`, `endpoint`, `lastHealthyAt`
- [ ] Migration: `drizzle/0004_plugin_install_fields.sql`

### Registry population
- [ ] Move 4 examples from `examples/plugins/` into registry with manifests
- [ ] Author 6 more plugins to hit 10-plugin target (gmail, gcal-import, notion-import, linear-import, todoist-import, pocket)

### Definition of done
- [ ] User installs a plugin from the in-app marketplace without leaving the app
- [ ] Plugin authors can submit via PR to `public/plugin-registry/`
- [ ] At least 10 plugins in the registry on launch
- [ ] Plugin authors can ship a theme as part of their plugin manifest
- [ ] CI validates submitted manifests automatically (via `@kairos/plugin-validator`)
- [ ] `@kairos/plugin-validator` + `@kairos/theme-validator` published to npm
- [ ] At least one plugin ships with Sigstore provenance and verifies on install
- [ ] Update → version bumps, config + memory preserved
- [ ] Rollback: install v2, roll back to v1, config + memory survive

---

## Not in v1

These are explicitly deferred. Don't build them:

- Chat / `chatSessions` / `/api/chat`
- Voice (returns as a plugin in phase 3)
- Multi-user (single-user only in v1)
- Stripe / paid tier (post-v1)
- Direct LLM provider SDKs anywhere outside `lib/llm/` and bundled plugins
- Paid plugins, revenue split
- Plugin sandboxing beyond HTTP isolation (no V8 isolates, no WebAssembly runtime)
- Plugin-to-plugin dependencies
- Private plugin registries / enterprise plugin stores
