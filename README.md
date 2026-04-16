# Kairos

**AI-native scheduling and task management.** Paste notes, emails, or ideas — Kairos extracts the tasks and automatically schedules them into your Google Calendar.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kairos-app/kairos&env=DATABASE_URL,BETTER_AUTH_SECRET,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET&envDescription=See%20.env.example%20for%20documentation&project-name=kairos&repository-name=kairos)

---

## What it does

- **Scratchpad** — paste any text; the bundled AI plugin extracts actionable tasks
- **Schedule-on-write** — creating a task automatically finds its next available slot in your calendar
- **Full re-schedule** — run a full optimisation pass that respects priorities, deadlines, and free/busy time
- **Plugin-first** — the scratchpad routes through a plugin host; swap or extend without touching core code
- **Theme system** — two built-in packs (dark + light); a marketplace with community packs arrives in phase 4

## Stack

Next.js 16 · TypeScript strict · Tailwind v4 · Drizzle + Postgres · Better Auth · Vercel AI SDK · TanStack Query · Framer Motion · GSAP

---

## Self-host with Docker

```bash
git clone https://github.com/kairos-app/kairos
cd kairos
cp .env.example .env.local
# Fill in BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and LLM keys
docker compose up
```

The `docker compose up` command starts the Next.js app on port 3000 and a Postgres 16 instance. Migrations run automatically on startup.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full local dev setup (without Docker).

---

## Deploy to Vercel

Click the button above, or:

1. Fork this repo
2. Create a Neon project at [neon.tech](https://neon.tech) (free tier)
3. Import the repo in Vercel and set the environment variables from `.env.example`
4. Run `pnpm db:migrate` against your Neon database once (or let the first request trigger it)

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | Random secret — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | App origin, e.g. `https://yourdomain.com` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `LLM_PROVIDER` | No | `openai` (default) · `anthropic` · `ollama` |
| `LLM_MODEL` | No | Model ID for the chosen provider |
| `OPENAI_API_KEY` | LLM=openai | OpenAI API key |
| `ANTHROPIC_API_KEY` | LLM=anthropic | Anthropic API key |
| `OLLAMA_URL` | LLM=ollama | Ollama base URL |
| `KAIROS_MODE` | No | `self-hosted` (default) · `hosted` |

---

## Architecture

```
app/api/          → Route handlers (thin — parse, auth, delegate)
lib/services/     → Business logic
lib/scheduler/    → Pure-function scheduling pipeline (urgency, slots, placement, splitting)
lib/gcal/         → Google Calendar modules (auth, events, free/busy)
lib/plugins/      → Plugin host + bundled text-to-tasks plugin
lib/llm/          → Vercel AI SDK abstraction (OpenAI / Anthropic / Ollama)
```

Locked decisions: tags-only taxonomy (no `Project` entity), Google Calendar as the only time store, schedule-on-write for single tasks, plugin-first scratchpad. See `references/architecture-decisions.md`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
