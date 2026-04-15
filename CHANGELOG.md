# CHANGELOG

Session memory for Kairos. Read this first every session. Update at session end without exception.

If a decision in this file conflicts with `references/architecture-decisions.md`, this file wins (it's newer). Promote permanent decisions back into ADRs at session end.

---

## Current State

**Phase:** 1 — Foundations (in progress)

### Built
- [x] `pnpm create next-app` baseline with TypeScript strict + Tailwind v4 + App Router
- [x] ESLint config with custom rules (ban `Project`/`projectId`, ban direct LLM provider imports)
- [x] Drizzle setup + Neon connection
- [x] Better Auth + Google OAuth (one flow grants app login + GCal scopes)
- [x] Drizzle schema for: `users`, `tasks`, `tags`, `taskTags`, `views`, `googleAccounts`, `googleCalendars`, `blackoutDays`, `scheduleWindows`, `jobs`, plus Better Auth tables
- [ ] Initial migration applied to a fresh DB
- [x] Smoke-test route handler at `/api/health`
- [x] Vitest + msw setup with one passing test
- [ ] Tasks CRUD (route handlers + service + tests)
- [ ] Tags CRUD
- [ ] Views CRUD
- [ ] Calendar list/select endpoint
- [x] Marketing route group scaffolded with placeholder landing page
- [x] App route group scaffolded with placeholder dashboard behind Better Auth
- [ ] Vercel preview deploys working from PRs
- [ ] Production deploy from main working
- [ ] Phase 1 definition-of-done met

### Active decisions (pending promotion to ADRs)
*(none yet)*

### Known issues
*(none yet)*

### Blocked on
*(nothing — first session can start)*

### Next concrete action
**Session 1** — see `references/migration-from-old-build.md` "Order of operations":
1. `pnpm create next-app kairos --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
2. Add ESLint custom rules
3. Install Drizzle + drizzle-kit + `@neondatabase/serverless`
4. Install Better Auth + Drizzle adapter
5. Set up Neon project (free tier) and add `DATABASE_URL` to `.env.local`
6. Set up Google Cloud OAuth credentials with both `email`/`profile` and `https://www.googleapis.com/auth/calendar` scopes
7. Write Drizzle schema for `users`, `tasks`, `tags`, `taskTags`, plus Better Auth's required tables
8. Generate + apply the first migration
9. Add a `/api/health` route handler that confirms DB connectivity
10. Push to GitHub, hook up Vercel, confirm preview deploys

Session 2 starts with the Tasks CRUD route handlers + service + tests.

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
