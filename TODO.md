# TODO — Kairos

Master checklist. Tracks what's built, what's next, and what's blocked across all phases.

---

## Phase 1 — Foundations

**Goal:** Empty Next.js app → working tasks/tags/views CRUD with auth and the GCal connection.

### Build checklist

- [ ] `pnpm create next-app` baseline with TypeScript strict + Tailwind v4 + App Router
- [ ] ESLint config with custom rules (ban `Project`/`projectId`, ban direct LLM provider imports)
- [ ] Drizzle setup + Neon connection
- [ ] Better Auth + Google OAuth (one flow grants app login + GCal scopes)
- [ ] Drizzle schema for: `users`, `tasks`, `tags`, `taskTags`, `views`, `googleAccounts`, `googleCalendars`, `blackoutDays`, `scheduleWindows`, `jobs`, plus Better Auth tables
- [ ] Initial migration applied to a fresh DB
- [ ] Smoke-test route handler at `/api/health`
- [ ] Vitest + msw setup with one passing test
- [ ] Tasks CRUD (route handlers + service + tests)
- [ ] Tags CRUD
- [ ] Views CRUD
- [ ] Calendar list/select endpoint
- [ ] Marketing route group scaffolded with placeholder landing page
- [ ] App route group scaffolded with placeholder dashboard behind Better Auth
- [ ] Vercel preview deploys working from PRs
- [ ] Production deploy from main working
- [ ] Phase 1 definition-of-done met

### Session 1 — bootstrap

1. [ ] `pnpm create next-app kairos --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
2. [ ] Add ESLint custom rules
3. [ ] Install Drizzle + drizzle-kit + `@neondatabase/serverless`
4. [ ] Install Better Auth + Drizzle adapter
5. [ ] Set up Neon project (free tier) and add `DATABASE_URL` to `.env.local`
6. [ ] Set up Google Cloud OAuth credentials with both `email`/`profile` and `https://www.googleapis.com/auth/calendar` scopes
7. [ ] Write Drizzle schema for `users`, `tasks`, `tags`, `taskTags`, plus Better Auth's required tables
8. [ ] Generate + apply the first migration
9. [ ] Add a `/api/health` route handler that confirms DB connectivity
10. [ ] Push to GitHub, hook up Vercel, confirm preview deploys

### Definition of done

- [ ] User can sign in with Google (one OAuth flow grants both app login and GCal access)
- [ ] User can create, list, update, delete tasks via the API and via the UI
- [ ] User can create tags and assign them to tasks
- [ ] User can connect a Google Calendar and see it listed
- [ ] No `projects` table, no `projectId` field, no `Project` type anywhere
- [ ] No `openai` / `@anthropic-ai/sdk` import anywhere in the repo
- [ ] CI passes: ESLint, TypeScript, Vitest, Drizzle migrations apply cleanly to a fresh DB
- [ ] Deploys to Vercel preview on every PR; merges to main deploy to production

---

## Phase 2 — Scheduler + GCal write-back + Scratchpad plugin host

**Goal:** Schedule-on-write works end-to-end. A task created via API or UI gets placed into Google Calendar automatically. The scratchpad accepts plain text and routes through the bundled plugin to extract candidate tasks.

### Backend

- [ ] `lib/scheduler/` — pure-function pipeline: `urgency.ts`, `slots.ts`, `placement.ts`, `splitting.ts`, `recurrence.ts`, `candidates.ts`, plus `runner.ts`
- [ ] `lib/gcal/` — `auth.ts`, `calendars.ts`, `freebusy.ts`, `events.ts`, `errors.ts`
- [ ] `lib/plugins/` — `host.ts`, `types.ts`, `context.ts`
- [ ] `lib/plugins/builtin/text-to-tasks/` — bundled plugin
- [ ] `lib/llm/` — Vercel AI SDK abstraction; `complete()` resolves to user's configured provider
- [ ] `app/api/schedule/run/route.ts` — manual full schedule run (enqueues chunked jobs)
- [ ] `app/api/cron/drain/route.ts` — Vercel Cron target, drains the `jobs` table
- [ ] `app/api/scratchpad` routes — create entry, list, process (routes to plugin), commit (creates tasks)
- [ ] `app/api/plugins` routes — list installed, configure, enable/disable
- [ ] Schedule-on-write hook in the `tasks` POST/PATCH handlers — enqueues a `schedule:single-task` job
- [ ] `vercel.json` cron config: `/api/cron/drain` every minute

### Frontend

- [ ] Routes under `app/(app)/`: `dashboard`, `tasks`, `schedule`, `scratchpad`, `tags`, `views`, `settings`
- [ ] Default design pack ("Obsidian"), ported from old build's CSS as semantic tokens
- [ ] TanStack Query for all data fetching; no raw `fetch` in components
- [ ] Server Components used where appropriate (lists that don't need interactivity)

### Definition of done

- [ ] User can paste plain text into the scratchpad → bundled plugin extracts candidate tasks → user previews → tasks created and auto-scheduled into GCal
- [ ] User can disable the bundled plugin and the scratchpad refuses to process plain text (proves no hardcoding)
- [ ] User can configure their LLM provider (OpenAI key, Anthropic key, or Ollama URL) in settings; the scratchpad uses it
- [ ] Single-task placement on write completes in under 3 seconds
- [ ] Full schedule run completes via chunked jobs, each chunk under 10 seconds
- [ ] Vitest unit tests cover all scheduler pure-function modules; integration tests cover the route handlers
- [ ] Lighthouse perf > 90 on dashboard, schedule, tasks
- [ ] All frontend code uses TanStack Query — no raw fetch in components

---

## Phase 3 — Open source (v1 ships)

**Goal:** Kairos is publicly usable. Self-hostable. Easy to extend.

### Scope

- [ ] Public GitHub repo
- [ ] License (MIT or Apache-2.0 — decide before this phase)
- [ ] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue + PR templates
- [ ] Vercel one-click deploy (button in README)
- [ ] Self-host via Docker — `docker compose up` runs the Next.js app + Postgres locally
- [ ] Plugin SDK: `@kairos/plugin-sdk` npm package — types, helpers, examples
- [ ] Example plugins in a separate repo:
  - [ ] `kairos-plugin-instagram` — paste a reel URL → tasks
  - [ ] `kairos-plugin-twitter` — paste a tweet/thread → tasks
  - [ ] `kairos-plugin-readwise` — pull highlights → reading tasks
  - [ ] `kairos-plugin-voice` — voice memo → transcribed text → tasks
- [ ] Landing page filled in at `app/(marketing)/`
- [ ] Documentation under `app/(marketing)/docs/`

### Definition of done

- [ ] A new contributor can clone, run `pnpm install && pnpm dev`, and have a working Kairos in <10 minutes
- [ ] A new plugin author can scaffold, build, and install a plugin in <30 minutes following the SDK docs
- [ ] At least 3 example plugins exist and pass CI
- [ ] Landing page is live with: hero, what-it-does, how-it's-different, plugin showcase, GitHub link, self-host instructions
- [ ] First public release tagged `v1.0.0`
- [ ] Hosted instance live at `kairos.app`

---

## Phase 4 — Plugin marketplace

**Goal:** Plugins are discoverable, installable from the UI, with reviews and version management.

### Scope

- [ ] Marketplace registry — JSON manifest in a public GitHub repo, or a small Vercel-hosted service backed by Postgres
- [ ] In-app plugin browser: search, install, configure, enable/disable
- [ ] Plugin submission flow for community contributors (PR to registry)
- [ ] Plugin signing and basic safety review (manual at first)
- [ ] Version management: update notifications, changelogs, rollback
- [ ] Decide: Option 1 (npm + redeploy), Option 2 (HTTP plugins), or Option 3 (hybrid)

### Definition of done

- [ ] User installs a plugin from inside the app without leaving it
- [ ] Plugin authors can submit via PR to the registry
- [ ] At least 10 plugins in the registry

---

## Not in v1

These are explicitly deferred. Don't build them:

- Chat / `chatSessions` / `/api/chat`
- Voice (returns as a plugin in phase 3)
- Multi-user (single-user only in v1)
- Plugin marketplace UI (phase 4)
- Stripe / paid tier (post-v1)
- Direct LLM provider SDKs anywhere outside `lib/llm/` and bundled plugins
