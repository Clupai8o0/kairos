# Project Structure — Kairos

The target layout for the `kairos` repo. Compare against the actual filesystem at session start — don't trust memory.

## Top-level

```
kairos/
├── CLAUDE.md                  # operating manual (read first every session)
├── CHANGELOG.md               # session memory
├── README.md                  # public-facing project doc
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── vercel.json                # cron config for /api/cron/drain
├── drizzle.config.ts
├── docker-compose.yml         # for self-hosters / local Postgres
├── Dockerfile
├── .env.example
├── .eslintrc.cjs              # custom rules: bans Project, projectId, direct LLM imports
│
├── app/                       # Next.js App Router
├── lib/
├── components/
├── drizzle/                   # generated SQL migrations
├── references/                # in-repo docs
└── tests/
```

## `app/` — routes

```
app/
├── (marketing)/               # static-rendered marketing pages
│   ├── layout.tsx
│   ├── page.tsx               # / (landing)
│   ├── docs/
│   │   ├── page.tsx
│   │   └── [...slug]/page.tsx
│   └── pricing/page.tsx       # only exists post-v1 if a paid tier launches
│
├── (app)/                     # authenticated app
│   ├── layout.tsx             # Better Auth check + app chrome
│   ├── dashboard/page.tsx
│   ├── tasks/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── schedule/page.tsx
│   ├── scratchpad/page.tsx
│   ├── tags/page.tsx
│   ├── views/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── settings/
│       ├── page.tsx
│       ├── llm/page.tsx       # configure LLM provider
│       ├── plugins/page.tsx   # list/install/configure plugins
│       └── calendars/page.tsx # connect Google calendars
│
├── api/                       # Route Handlers — THIN
│   ├── auth/
│   │   └── [...all]/route.ts  # Better Auth
│   ├── tasks/
│   │   ├── route.ts           # GET, POST
│   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   ├── tags/
│   ├── views/
│   ├── blackout-days/
│   ├── schedule-windows/
│   ├── schedule/
│   │   └── run/route.ts       # POST — enqueues full re-schedule
│   ├── calendars/
│   ├── scratchpad/
│   │   ├── route.ts           # GET (list), POST (create)
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── process/route.ts  # POST — runs plugin
│   │       └── commit/route.ts   # POST — creates tasks
│   ├── plugins/
│   │   ├── route.ts           # GET (installed), POST (install)
│   │   └── [name]/
│   │       ├── route.ts       # GET, DELETE
│   │       ├── config/route.ts
│   │       └── enable/route.ts
│   └── cron/
│       └── drain/route.ts     # Vercel Cron target
│
├── layout.tsx                 # root layout
└── styles/
    ├── globals.css
    └── packs/
        └── obsidian.css       # placeholder until design system happens
```

## `lib/` — server-side logic

```
lib/
├── db/
│   ├── client.ts              # Drizzle instance + Neon driver
│   ├── schema/
│   │   ├── users.ts
│   │   ├── tasks.ts
│   │   ├── tags.ts
│   │   ├── views.ts
│   │   ├── blackout-days.ts
│   │   ├── schedule-windows.ts
│   │   ├── schedule-logs.ts
│   │   ├── google.ts          # googleAccounts, googleCalendars
│   │   ├── scratchpads.ts
│   │   ├── plugins.ts         # pluginInstalls, scratchpadPluginConfigs
│   │   ├── jobs.ts
│   │   ├── auth.ts            # Better Auth tables (re-exported from adapter)
│   │   └── index.ts
│   └── seed.ts
│
├── auth/
│   ├── server.ts              # Better Auth instance
│   └── helpers.ts             # currentUser(), requireAuth(), apiKeyAuth()
│
├── services/                  # business logic
│   ├── tasks.ts
│   ├── tags.ts
│   ├── views.ts
│   ├── schedule.ts            # orchestration; enqueues jobs, calls runner
│   ├── scratchpad.ts          # delegates to plugins/host
│   ├── plugins.ts             # install, configure, enable/disable
│   ├── jobs.ts                # enqueue, drain, retry
│   ├── blackout.ts
│   └── schedule-windows.ts
│
├── scheduler/                 # ADR-R1 — pure-function pipeline
│   ├── candidates.ts
│   ├── urgency.ts
│   ├── slots.ts
│   ├── placement.ts
│   ├── splitting.ts
│   ├── recurrence.ts
│   ├── runner.ts              # the only file that touches DB + GCal
│   └── types.ts               # shared dataclasses for the pipeline
│
├── gcal/                      # ADR-R2 — split by concern
│   ├── auth.ts
│   ├── calendars.ts
│   ├── freebusy.ts
│   ├── events.ts
│   └── errors.ts
│
├── plugins/
│   ├── host.ts                # loader, registry, dispatcher
│   ├── types.ts               # interface + Zod schemas
│   ├── context.ts             # PluginContext implementation
│   └── builtin/
│       └── text-to-tasks/
│           ├── index.ts
│           ├── plugin.ts
│           ├── prompts.ts
│           └── manifest.json
│
├── llm/                       # ADR-R10 — only place provider SDKs live
│   ├── index.ts               # complete(), completeStructured()
│   └── providers.ts           # resolves user config to a provider instance
│
└── utils/
    ├── cuid.ts
    └── time.ts
```

## `components/` — React

```
components/
├── ui/                        # shadcn primitives (button, input, dialog, etc.)
├── tasks/
├── schedule/
├── scratchpad/
├── plugins/
├── settings/
└── marketing/                 # landing page sections
```

## `tests/`

```
tests/
├── setup.ts                   # Vitest setup, msw server lifecycle
├── unit/
│   ├── scheduler/
│   │   ├── urgency.test.ts
│   │   ├── slots.test.ts
│   │   ├── placement.test.ts
│   │   ├── splitting.test.ts
│   │   └── recurrence.test.ts
│   └── gcal/
│       ├── auth.test.ts
│       ├── freebusy.test.ts
│       ├── events.test.ts
│       └── errors.test.ts
├── integration/
│   ├── tasks.test.ts
│   ├── tags.test.ts
│   ├── views.test.ts
│   ├── schedule-run.test.ts
│   ├── schedule-windows.test.ts
│   ├── blackout-days.test.ts
│   ├── scratchpad.test.ts
│   ├── plugins.test.ts
│   ├── calendars.test.ts
│   └── auth.test.ts
└── fixtures/
```

Tests removed from the old build (do not port):
- `test_projects.py`, `test_projects_bearer_auth.py` — projects are gone
- `test_chat.py` — chat is post-v1

## Module boundary rules

1. **Route handlers call services. Services call the DB, the scheduler pipeline, GCal modules, and the plugin host. Pipelines are pure.**
2. **`lib/scheduler/` submodules other than `runner.ts` are pure** — no DB session, no `googleapis` import, no `fetch`. Inputs in, outputs out.
3. **`lib/gcal/` submodules** are the only place `googleapis` gets imported. Services depend on `lib/gcal/*`, never directly on `googleapis`.
4. **`lib/plugins/` is the only place LLM provider SDKs may be imported,** and only inside specific bundled plugin packages plus `lib/llm/`. Everywhere else uses `PluginContext.complete()` or the abstraction.
5. **`app/api/*` files are thin.** A route handler that exceeds ~80 lines is doing service work. Move it.
6. **No `lib/scheduler.ts` file** — that's a directory, not a file. Same for `lib/gcal/`, `lib/plugins/`, `lib/db/schema/`.
7. **Server-only code lives in `lib/`.** Client-only code lives in `components/` or under `app/`. Code shared between server and client (types, Zod schemas) lives in a clearly-marked location like `lib/types/` or alongside the schema.

## File size soft caps

| Layer                              | Soft cap | Hard cap |
|------------------------------------|----------|----------|
| `app/api/**/route.ts`              | 80       | 120      |
| `lib/services/*.ts`                | 200      | 250      |
| `lib/scheduler/*.ts`               | 150      | 200      |
| `lib/gcal/*.ts`                    | 200      | 250      |
| `lib/plugins/host.ts`              | 200      | 250      |
| `lib/plugins/types.ts`             | 100      | 150      |
| `lib/db/schema/*.ts`               | 100      | 150      |

If you're adding lines that would push past the hard cap, **split first, then add**.
