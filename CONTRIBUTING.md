# Contributing to Kairos

Thanks for taking the time to contribute. This document covers how to get the project running locally, the code conventions you need to follow, and how to submit changes.

## Getting started

### Prerequisites

- Node.js 22+
- pnpm 9+
- A Google Cloud project with OAuth credentials (see below)
- A Postgres database (Neon free tier works, or run locally with Docker)

### Local setup

```bash
git clone https://github.com/kairos-app/kairos
cd kairos
pnpm install

cp .env.example .env.local
# Fill in the values in .env.local (see comments in that file)

pnpm db:migrate   # Apply Drizzle migrations to your database
pnpm dev          # Start the Next.js dev server on http://localhost:3000
```

### Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI
4. Enable the **Google Calendar API** in APIs & Services → Library
5. Copy the Client ID and Secret into `.env.local`

Scopes needed: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar`

---

## Development workflow

```bash
pnpm dev         # Dev server
pnpm build       # Production build
pnpm lint        # ESLint (must pass before PR)
pnpm typecheck   # TypeScript strict check
pnpm test        # Vitest unit + integration tests
pnpm db:generate # Generate Drizzle migration from schema changes
pnpm db:migrate  # Apply pending migrations
```

---

## Code conventions

### Architecture rules (non-negotiable)

These rules come from the locked ADRs. Breaking them will fail CI.

1. **No `Project` entity.** Tags are the only taxonomy. No `projectId` field anywhere.
2. **No direct LLM provider imports** outside `lib/llm/` and `lib/plugins/builtin/`. Use `PluginContext.complete()` for LLM calls.
3. **Service files stay under 250 lines.** Split into smaller modules if you're approaching the limit.
4. **Route handlers are thin.** Parse, auth, delegate to a service, return. No business logic.
5. **Long-running work goes through the `jobs` table.** Nothing that might exceed 10 seconds in a route handler.

### Design / UI rules

- Use semantic tokens only — `bg-surface`, `text-fg`, `border-wire`. Never raw Tailwind colours (`bg-zinc-900`) or hex literals. The `no-raw-colors` ESLint rule enforces this.
- App pages use Framer Motion for micro-interactions. Landing page uses GSAP for scroll-driven animations.
- All async mutations use `toast.promise()` from Sonner for feedback. No inline spinners on buttons.

### TypeScript

- Strict mode is on. No `any` without a comment explaining why.
- Zod for all external input validation (API request bodies, environment variables).
- TanStack Query for all client-side data fetching. No raw `fetch` in components.

---

## Submitting a pull request

1. Fork the repo and create a branch from `main`
2. Make your changes. If touching a backend service, add or update the relevant test in `tests/`
3. Run `pnpm lint && pnpm typecheck && pnpm test` — all must pass
4. Open a PR. The title should describe *what* changed; the body should explain *why*
5. A maintainer will review. Small, focused PRs merge faster

### What we're looking for

- Bug fixes with a test that would have caught the bug
- New plugins (in a separate repo — see the plugin SDK docs)
- New theme packs (JSON manifests in `references/theme-system.md` format)
- Improvements to the scheduler pure-function pipeline (`lib/scheduler/`)
- Performance improvements with before/after measurements

### What we're not looking for (in v1)

- Chat / voice features (deferred post-v1)
- New database tables that aren't in the approved schema
- Anything that requires a new required environment variable without a self-hosted fallback
- Framework migrations or major dependency upgrades without a prior discussion

---

## Project structure

```
kairos/
├── app/
│   ├── (marketing)/   Landing page and docs (GSAP animations)
│   ├── (app)/         Authenticated app shell and pages
│   └── api/           Route handlers (thin — delegate to lib/services/)
├── lib/
│   ├── db/            Drizzle schema + client
│   ├── services/      Business logic
│   ├── scheduler/     Pure-function scheduling pipeline
│   ├── gcal/          Google Calendar modules
│   ├── plugins/       Plugin host + bundled text-to-tasks plugin
│   └── llm/           Vercel AI SDK abstraction
├── components/        Shared React components
├── references/        Architecture decision records + specs
└── tests/             Unit + integration tests (Vitest + msw)
```

Read `CLAUDE.md` and `references/architecture-decisions.md` for the full design rationale.

---

## Reporting a bug

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, self-hosted or hosted)

## Security vulnerabilities

Please **do not** open a public issue for security vulnerabilities. Email security@kairos.app instead.
