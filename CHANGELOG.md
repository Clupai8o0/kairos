# CHANGELOG

Session memory for Kairos. Read this first every session. Update at session end without exception.

If a decision in this file conflicts with `references/architecture-decisions.md`, this file wins (it's newer). Promote permanent decisions back into ADRs at session end.

---

## Current State

**Phase:** 1 — Foundations (not started)

### Built
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

*(none yet)*
