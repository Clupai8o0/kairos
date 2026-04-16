# CLAUDE.md — Kairos

You are working on **Kairos** — an AI-native scheduling and task management app, built as a single Next.js 16 application on Vercel. This is a rewrite of an earlier Python/FastAPI build (`kairos-api` + `kairos-app`) that drifted from its own architecture: the scheduler grew to 973 lines, `gcal_service` to 1051, the `Project` model survived a tags-only ADR, the scratchpad hardcoded an OpenAI call inside service code. This rewrite collapses all of that into a smaller, plugin-first TypeScript codebase.

**Read this entire file before touching code. Then follow the read order below.**

---

## Read order (every session, no exceptions)

1. `CHANGELOG.md` — what state the rewrite is in, what's next, what's blocked
2. `TODO.md` — master checklist across all phases
3. `references/architecture-decisions.md` — locked ADRs (R1–R13)
3. The reference file relevant to the module you're touching:

| Working on…                  | Read this first                              |
|------------------------------|----------------------------------------------|
| Drizzle schema / models      | `references/data-model.md`                   |
| Scheduler pipeline           | `references/scheduling-engine.md`            |
| Google Calendar              | `references/gcal-integration.md`             |
| API route handlers           | `references/api-contract.md`                 |
| Plugin host / scratchpad     | `references/plugin-system.md`                |
| Design system / theme arch   | `references/design-system.md`                |
| Theme tokens / packs         | `references/theme-system.md`                 |
| Theme marketplace            | `references/theme-marketplace.md`            |
| Tests                        | `references/testing.md`                      |
| Project layout               | `references/project-structure.md`            |
| Migration / porting context  | `references/migration-from-old-build.md`     |

If `CHANGELOG.md` and an ADR conflict, **CHANGELOG.md wins** — it's newer. Promote permanent decisions back into `references/architecture-decisions.md` as a new ADR-Rn at session end.

---

## The non-negotiables

These are the rules the old build broke. Do not break them again.

### 1. No `Project` entity. Anywhere.
Tags are the only taxonomy. No `projects` table, no `projectId` column, no `/api/projects` route, no `Project` type, no "project" as a domain concept in the frontend. If you find yourself typing the word "project" as a domain noun, stop — it's a tag.

The CI lint check enforces this: any appearance of `Project` or `projectId` as identifiers (outside of git/PR/Vercel project metadata, which uses different names) fails the build.

### 2. No LLM provider SDK in the core.
`openai`, `@anthropic-ai/sdk`, any provider-specific package — these belong in `lib/llm/` (the AI SDK abstraction layer) and inside specific bundled plugins. They do not appear elsewhere in `lib/` or `app/`.

If you need to call an LLM from a service or a route handler, you're in the wrong place — the LLM call belongs inside a plugin, and plugins talk to the user's configured provider through `PluginContext.complete()`.

### 3. Soft cap: 250 lines per service file.
The old `scheduler.py` was 973 lines and `gcal_service.py` was 1051. That is the failure mode this rewrite exists to prevent. If a file is approaching 250 lines, split it before adding more. The scheduler is a pipeline of pure functions, not a god-file. The GCal layer is a directory of small modules, not a class.

### 4. Pipelines, not god-files.
The scheduler lives in `lib/scheduler/` as separate pure-function modules:
```
lib/scheduler/
├── candidates.ts    # which tasks need scheduling right now
├── urgency.ts       # pure scoring, no IO
├── slots.ts         # free slot computation
├── placement.ts     # which slot a task goes into
├── splitting.ts     # break long tasks into chunks
├── recurrence.ts    # generate occurrence dates
└── runner.ts        # the only file that touches DB + GCal
```
Everything except `runner.ts` is pure and unit-testable without a database, GCal mock, or HTTP client. `runner.ts` is a thin orchestrator.

### 5. GCal is a directory of small modules.
```
lib/gcal/
├── auth.ts          # OAuth + token refresh
├── calendars.ts     # list / select connected calendars
├── freebusy.ts      # free/busy queries
├── events.ts        # event CRUD
└── errors.ts        # GoogleApi error → domain error mapping
```
No file over ~250 lines. No abstraction that owns more than one concern. Route handlers and services never import directly from `googleapis` — always via `lib/gcal/*`.

### 6. Route handlers are thin.
Files under `app/api/` parse, authorise, delegate to a service, return. No business logic in route handlers. The old `api/schedule.py` hit 543 lines — that's a route doing service work. Don't repeat it.

### 7. Schedule-on-write means single-task placement.
Creating or updating a schedulable task triggers automatic placement of that *one* task into the next available slot. That's a 1-3 second operation that fits in a Vercel function. Full re-optimisation of all tasks happens on cron or explicit user action, broken into chunked job invocations that each finish in <10s.

### 8. Google Calendar is the only time store.
Tasks store `gcalEventId` and a denormalised `scheduledAt` cache. That's it. No time blocks live in the DB.

### 9. Scratchpad is a plugin host.
The scratchpad service knows nothing about OpenAI, Instagram, or any specific source. It dispatches to plugins via `lib/plugins/host.ts`. There is exactly one bundled plugin in core: `lib/plugins/builtin/text-to-tasks/`. Everything else is loaded from outside (npm or HTTP — phase 4 decision).

### 10. v1 ships less than the old build had.
**Not in v1:** chat / `chatSessions` / `/api/chat`, voice. Don't build them. They come back as plugins or post-v1 features.

### 11. Background work goes through the `jobs` table, never blocks a request.
Anything that might exceed 10 seconds (full schedule run, GCal sync of many events, batch operations) gets enqueued as a job and drained by `app/api/cron/drain/route.ts`. Each job invocation must complete in <10s — if it can't, decompose it into smaller jobs that enqueue follow-ups.

### 12. Don't read the old Python codebase while writing new TypeScript.
The old `kairos-api` repo is reference material for *understanding* — what behaviour was expected, what edge cases came up, what the GCal API actually does. It is not source material for line-by-line translation. TypeScript that thinks it's Python is the worst possible outcome. Read the spec docs (`references/scheduling-engine.md`, `references/gcal-integration.md`) and write fresh TypeScript from understanding, not from translation.

---

## Stack (locked)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| Runtime | Node.js (not Edge) |
| Language | TypeScript strict |
| Package manager | pnpm |
| ORM | Drizzle |
| Database | Postgres 16 (Neon) |
| DB driver | `@neondatabase/serverless` |
| Migrations | drizzle-kit |
| Auth | Better Auth (Google OAuth provider also grants GCal scopes) |
| Validation | Zod |
| LLM abstraction | Vercel AI SDK (`ai`) |
| Forms | react-hook-form + Zod resolver |
| Client data fetching | TanStack Query 5 |
| Client state | Zustand |
| Background jobs | Postgres `jobs` table + Vercel Cron |
| Tests | Vitest + Testing Library + msw |
| Lint | ESLint (custom rules ban `Project`/`projectId` and direct LLM provider imports) |
| Hosting | Vercel (free tier) + Neon (free tier) + Cloudflare DNS |

No Celery, Redis, BullMQ in v1. No separate worker process. No Clerk. No Python.

---

## Repo layout

```
kairos/
├── CLAUDE.md                  ← you are here
├── CHANGELOG.md               ← session memory
├── TODO.md                    ← master checklist
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── vercel.json                ← cron config
├── drizzle.config.ts
├── docker-compose.yml         ← for self-hosters
│
├── app/
│   ├── (marketing)/           ← landing + docs (static)
│   ├── (app)/                 ← authenticated app
│   ├── api/                   ← Route Handlers (thin)
│   └── styles/
│
├── lib/
│   ├── db/                    ← Drizzle schema + client
│   ├── auth/                  ← Better Auth instance + helpers
│   ├── services/              ← business logic
│   ├── scheduler/             ← pure-function pipeline (ADR-R1)
│   ├── gcal/                  ← GCal split (ADR-R2)
│   ├── plugins/               ← plugin host + bundled plugin
│   ├── llm/                   ← AI SDK abstraction
│   └── utils/
│
├── components/                ← shared React components
├── drizzle/                   ← generated SQL migrations
├── references/                ← in-repo reference docs
└── tests/                     ← unit + integration
```

Route handlers call services. Services call pipelines, plugins, and `lib/db`. Pipelines are pure. Models never import services. No circular deps.

---

## Session checklist

### Start
- [ ] Read `CHANGELOG.md`
- [ ] Read `references/architecture-decisions.md`
- [ ] Read the reference file for the module you're about to touch
- [ ] Verify actual file state — don't trust memory

### During
- [ ] Smallest change that makes the tests pass
- [ ] Tests first when feasible (translate from `references/testing.md`)
- [ ] Type strict — no `any` without justification
- [ ] No service file over 250 lines — split first if approaching
- [ ] No direct LLM provider imports outside `lib/llm/` and bundled plugins
- [ ] No `Project` / `projectId` reappearing
- [ ] No raw colour literals in components — use semantic tokens only (`no-raw-colors` ESLint rule)
- [ ] No long-running operation in a route handler — use the `jobs` table
- [ ] ESLint clean
- [ ] **Commit after every completed feature** — each self-contained addition (route handler, service, schema change, test suite) gets its own commit before moving to the next

### End
- [ ] Append a session log to `CHANGELOG.md`
- [ ] Tick off "Current State" checklist items
- [ ] Promote any permanent decisions to `references/architecture-decisions.md` as ADR-Rn
- [ ] State the next concrete action for the next session

---

## Anti-patterns — stop the session if you see these

- A service file growing past 500 lines without being split
- `import OpenAI from 'openai'` (or any provider SDK) anywhere outside `lib/llm/` or `lib/plugins/builtin/`
- A `Project` type, `projectId` field, or `/api/projects` route reappearing
- A route handler doing real work instead of delegating
- A long-running operation directly in a route handler instead of via the `jobs` table
- A new feature being added to v1 that isn't in `references/architecture-decisions.md`'s phase 1 or 2 scope
- A frontend component referencing chat or voice routes
- A hardcoded design token (`bg-zinc-900`) instead of a semantic one (`bg-surface`) — enforced by `eslint-rules/no-raw-colors.js`
- A `chatSessions` table or chat route reappearing
- Reading `kairos-api/*.py` files and porting them line-by-line into TypeScript

If any of these happen, stop, say so, and reset before continuing.

---

## How Sam works

- Vision → architecture → implementation, in that order. Don't jump layers.
- Direct, concise. Verbosity is a quota waste.
- Em dashes without spaces: `word—word`.
- Prefer deletion over addition. The rewrite exists because the old build was too big.
- When asked for a code change, scope it tightly. No "while we're here" refactors.
- Make reasonable assumptions and state them, rather than asking unnecessary clarifying questions.

## When to ask before acting

- Any change to a locked ADR
- Any new dependency
- Any change that affects the public API contract
- Any change that touches more than 5 files at once

---

## Skills & design system

### Design system
`DESIGN.md` (Linear-inspired) is the design reference. Read it before writing any UI component. Use semantic tokens from it—never hardcode colors.

### Loading & async feedback — Sonner
Any operation that takes time (mutations, background work) must use **Sonner** toasts, not inline spinners:

```ts
const p = someAsyncMutation.mutateAsync(data);
toast.promise(p, { loading: 'Doing thing…', success: 'Done', error: (e) => e?.message ?? 'Failed' });
try { await p; /* side effects on success */ } catch { /* toast handles display */ }
```

Rules:
- Never show `animate-spin` spinners on buttons or in page headers for async work—Sonner shows that feedback.
- Initial data loads (first paint) keep skeleton `animate-pulse` placeholders—those are layout, not feedback.
- Toggle switches (instant) and quick status changes are silent—no toast needed.
- `<Toaster>` is mounted once in `components/providers.tsx` with the dark theme config. Never add a second `<Toaster>`.

### Animation strategy
- **Landing page (`app/(marketing)/`):** GSAP for scroll-driven, orchestrated animations. Skills: `gsap-core`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-react`.
- **Dashboard (`app/(app)/`):** Framer Motion for micro-interactions (hover, mount/unmount, layout shifts). Lighter weight, React-native integration.
- Don't mix—GSAP on marketing, Framer Motion in-app.

### Skills by module

| Working on…                     | Use these skills                                               |
|---------------------------------|----------------------------------------------------------------|
| UI components (shadcn)          | `shadcn-component-discovery`, `shadcn-component-review`        |
| Landing page animations         | `gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-performance` |
| Dashboard micro-animations      | (framer-motion—no skill, use library docs)                     |
| Design tokens / theming         | `design-dna`, `theme-factory`                                  |
| UI/UX review                    | `userinterface-wiki`, `ui-ux-pro-max`, `web-design-guidelines` |
| Frontend patterns               | `frontend-design`, `vercel-react-best-practices`, `vercel-composition-patterns` |
| Code review                     | `code-review`, `verification-before-completion`                |
| Debugging                       | `systematic-debugging`                                         |
| Testing                         | `test-driven-development`, `webapp-testing`                    |
| Planning                        | `writing-plans`, `executing-plans`                             |
