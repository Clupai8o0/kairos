# Kairos — Claude Project Context

This bundle is the project knowledge for the Kairos rewrite. Drop every file in this folder into a new Claude chat project as project knowledge.

## What Kairos is
An AI-native scheduling and task management app. Tasks go in, the engine decides when they happen, Google Calendar reflects reality. Phase 3 onward becomes open source with a plugin marketplace.

## What this rewrite is for
The previous build was a Python/FastAPI backend (`kairos-api`) plus a Next.js frontend (`kairos-app`) across two repos. It worked but suffered from: bloated services (scheduler at 973 lines, gcal_service at 1051), drift from locked decisions (a `Project` model still existed despite the tags-only ADR), hardcoded LLM calls inside service code, and two-repo coordination overhead.

The rewrite collapses everything into a **single Next.js 16 application on Vercel**. One TypeScript codebase handles frontend, API routes, background jobs, and the landing page. Total cost to operate: ~$1/mo (just the domain). Vercel + Neon free tiers cover the rest.

Stack switch from Python to TypeScript happened because the original stack choice (ADR-001) was anchored in the Meta Back-End cert, which Sam is no longer pursuing. With that constraint dropped, the TypeScript-on-Vercel path is more efficient for a solo dev.

## Read order
1. `00-vision.md` — what Kairos is for, who it's for, what makes it different
2. `01-rewrite-rationale.md` — why the old build failed, why the stack changed, what to keep, what to drop
3. `02-architecture.md` — locked decisions, including the rewrite-specific ADR-R1..R13
4. `03-data-model.md` — the slimmed-down entity model in Drizzle terms
5. `04-phases.md` — phase 1 / 2 / 3 (open source) / 4 (marketplace)
6. `05-plugin-system.md` — how plugins, scratchpad rulesets, and custom memory work
7. `06-design-system.md` — placeholder; design system intentionally deferred
8. `07-landing-page.md` — landing page brief; lives in the same Next.js app
9. `08-tech-stack.md` — the full stack (Next.js, Drizzle, Better Auth, Vercel AI SDK, etc.)
10. `09-working-style.md` — how Sam works with Claude on this project
11. `10-claude-code-workflow.md` — how to use Claude Code effectively for the rewrite
12. `11-hosting-and-monetisation.md` — Vercel + Neon hosting, hosted/self-host split, BYO LLM model

## Suggested project system prompt
> You are assisting Sam on the Kairos rewrite — an AI-native scheduling and task management app being rebuilt as a single Next.js 16 application on Vercel. The previous Python/FastAPI build is being replaced. Read `01-rewrite-rationale.md` and `02-architecture.md` before proposing anything structural. Stay in the layer Sam is currently at (vision → architecture → implementation) and don't jump ahead. Direct, concise, no fluff. Em dashes without spaces. Respect locked decisions: tags-only (no Project entity), Google Calendar as sole source of truth for time, single Next.js app for everything, schedule-on-write, plugin-first scratchpad, BYO LLM keys via the AI SDK abstraction. Don't propose speculative features for V1. When proposing code, prefer deletion over addition — the rewrite exists because the old build was too big. Verify current information (hosting prices, library versions, free tiers) via web search before recommending — these change constantly.

## Migration from the old build
- **Code:** not ported. Rebuilt from spec. The old Python files are reference material when the spec is unclear, not source for translation.
- **Data:** not migrated. Clean slate. Old build's data is dev/test data; nothing to preserve.
- **Old repos:** archived on GitHub (read-only), kept for reference, not actively maintained.
- **Reference docs from the old build:** the algorithmic and behavioural ones (`scheduling-engine.md`, `testing.md`, `gcal-integration.md`, `data-model.md`, `api-contract.md`) are language-independent and carry forward into the new repo's `references/` folder, with a banner noting the implementation language has changed.
