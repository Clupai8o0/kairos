# Plugin System — Kairos

The most important architectural decision in the rewrite. The old build had a hardcoded scratchpad. The new build has a plugin host. **The core never imports an LLM provider SDK directly** — that's what plugins are for, and even plugins go through `lib/llm/`.

This file is the in-repo reference for actually building the host and the bundled plugin. For the long-form rationale, see `05-plugin-system.md` in the chat project knowledge.

---

## What plugins do

A plugin takes input (text, URL, file, voice clip, share intent) and turns it into one or more candidate tasks the user can review and commit.

The core ships **one** plugin in-repo: `lib/plugins/builtin/text-to-tasks/`. It does what the old `scratchpad_service.py` did — extract tasks from a brain dump — but as a plugin, using whatever LLM the user has configured.

Everything else lives outside the core repo (npm packages or HTTP services — phase 4 decision).

---

## The contract

```typescript
// lib/plugins/types.ts
import { z } from 'zod';

export const ScratchpadInputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  inputType: z.enum(['text', 'url', 'share', 'voice', 'file']),
  content: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.date(),
});

export const CandidateTaskSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  durationMins: z.number().int().nullable().optional(),
  deadline: z.date().nullable().optional(),
  priority: z.number().int().min(1).max(4).default(3),
  tags: z.array(z.string()).default([]),
  sourceMetadata: z.record(z.unknown()).default({}),
});

export const ParseResultSchema = z.object({
  pluginName: z.string(),
  pluginVersion: z.string(),
  tasks: z.array(CandidateTaskSchema),
  rawOutput: z.record(z.unknown()),
  warnings: z.array(z.string()).default([]),
});

export type ScratchpadInput = z.infer<typeof ScratchpadInputSchema>;
export type CandidateTask = z.infer<typeof CandidateTaskSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;

export interface ScratchpadPlugin {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;

  handlesInputTypes: ReadonlyArray<ScratchpadInput['inputType']>;

  canHandle(input: ScratchpadInput): boolean;

  parse(input: ScratchpadInput, context: PluginContext): Promise<ParseResult>;

  onInstall?(context: PluginContext): Promise<void>;
  onUninstall?(context: PluginContext): Promise<void>;
}
```

---

## PluginContext

```typescript
// lib/plugins/context.ts
import { z } from 'zod';

export interface PluginContext {
  userId: string;
  pluginName: string;

  // Config — structured, validated against plugin's config schema
  getConfig<T = Record<string, unknown>>(): Promise<T>;
  setConfig<T = Record<string, unknown>>(config: T): Promise<void>;

  // Memory — opaque, plugin-managed
  getMemory<T = Record<string, unknown>>(): Promise<T>;
  setMemory<T = Record<string, unknown>>(memory: T): Promise<void>;
  updateMemory(patch: Record<string, unknown>): Promise<void>;

  // Rulesets — user-defined, plugin-evaluated
  getRulesets(): Promise<Array<Record<string, unknown>>>;

  // LLM — resolves to whatever the user has configured, via lib/llm
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeStructured<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T>;

  // Logging — structured
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void;
}
```

`complete` and `completeStructured` are the most important methods. They route through `lib/llm/`, which uses the Vercel AI SDK to call whatever provider the user configured (OpenAI, Anthropic, Ollama, LM Studio, Groq, etc.). Plugins do not import provider SDKs directly.

---

## Host responsibilities

`lib/plugins/host.ts` (target: ~200 lines):

1. **Loader** — discover installed plugins from `pluginInstalls` rows. For bundled plugins, resolve via static import. For external plugins (phase 4), resolve via npm dynamic import or HTTP URL registration.
2. **Registry** — in-memory map of `pluginName -> plugin` for the lifetime of the serverless invocation. Cold-start re-loads it, which is fine — the load is cheap.
3. **Dispatcher** — given a `ScratchpadInput`, ask each enabled plugin's `canHandle()` in priority order. First match wins. Fallback to `text-to-tasks` if nothing claims it (and it's enabled).
4. **Lifecycle** — call `onInstall` / `onUninstall` when `pluginInstalls` rows change.
5. **Context factory** — produce a `PluginContext` scoped to a `(userId, pluginName)` pair.

The host **never** parses input itself. It only routes.

---

## Routing rules

When a scratchpad entry is created:

1. Host looks at `inputType` and `payload`
2. Host iterates enabled plugins in priority order (configurable per user)
3. First plugin whose `canHandle()` returns `true` gets the entry
4. If nothing claims it, the bundled `text-to-tasks` plugin handles it (assuming enabled)
5. The plugin's `ParseResult` is stored on `scratchpads.parseResult`
6. The user reviews → commits → tasks are created with `source = 'scratchpad:<plugin-name>'`

---

## Rulesets — user-facing deterministic control

Rulesets are evaluated by the plugin **inside** its `parse()` method, after the LLM call but before returning the `ParseResult`. They give users deterministic control without writing code.

Examples:
- Instagram plugin: "Skip reels under 15 seconds", "Tag fitness reels with `health`"
- Builtin text plugin: "If task contains 'email' or 'reply', set duration to 10 mins", "If task contains 'meeting', tag with `meetings`"

Rulesets stored as JSON in `scratchpadPluginConfigs.rulesets`. The plugin author decides the rule schema for their plugin.

---

## The bundled plugin: `text-to-tasks`

`lib/plugins/builtin/text-to-tasks/` is the only plugin in the core repo.

### Structure
```
text-to-tasks/
├── index.ts          # exports the plugin
├── plugin.ts         # implements ScratchpadPlugin
├── prompts.ts        # all LLM prompts live here, never elsewhere
└── manifest.json
```

### What it does
- `canHandle()` returns `true` if `inputType === 'text'`
- `parse()` calls `context.completeStructured(prompt, CandidateTasksSchema)` and gets back validated candidate tasks; applies any rulesets; returns a `ParseResult`
- `tags` come out as `string[]`. **Never** a `projectName`. ADR-R7.

### What it does NOT do
- Never imports `openai`, `@anthropic-ai/sdk`, or any provider SDK directly — only uses `PluginContext`
- Never writes to the database — that happens at commit time, in `lib/services/scratchpad.ts`
- Never creates `tasks` rows directly — ditto

---

## External plugin packaging (phase 3+)

Three options under consideration. Phase 1-2 only ships the bundled plugin so the choice can be deferred.

### Option 1 — npm packages bundled at build time
Plugin authors publish `@kairos-plugin/instagram` etc. on npm. Users install via `package.json` and redeploy. Marketplace UI does the equivalent of `pnpm add` and triggers a Vercel rebuild.

### Option 2 — HTTP plugins
Plugin authors deploy their plugin as a separate Vercel/Cloudflare function. Kairos calls them over HTTP with a standardised contract. Marketplace is a registry of plugin URLs.

### Option 3 — Hybrid (default-leaning)
Built-in plugins ship in the bundle; community plugins use HTTP. Best of both — official plugins are fast, community plugins are install-without-redeploy.

Decision deferred to phase 4.

---

## What lives where — the import map

| File / package                                  | May import                                          | May NOT import                          |
|-------------------------------------------------|------------------------------------------------------|------------------------------------------|
| `lib/services/scratchpad.ts`                    | `lib/plugins/host`, db schema, Zod                  | LLM provider SDKs, specific plugins      |
| `lib/plugins/host.ts`                           | `lib/plugins/types`, `lib/plugins/context`, `lib/llm` | LLM provider SDKs directly             |
| `lib/plugins/types.ts`                          | Zod                                                  | anything else                            |
| `lib/plugins/context.ts`                        | db schema, `lib/llm`                                 | LLM provider SDKs directly               |
| `lib/plugins/builtin/text-to-tasks/`            | `lib/plugins/types`, `lib/plugins/context`           | the rest of `lib/`                       |
| `lib/llm/`                                      | `ai` (Vercel AI SDK), provider packages              | (only place provider packages allowed)   |
| Anywhere else in `lib/` or `app/`               | nothing LLM-related                                  | `openai`, `@anthropic-ai/sdk`, etc.      |

**The CI rule:** ESLint config bans direct provider imports outside `lib/llm/` and `lib/plugins/builtin/**`. Grep step in CI catches anything ESLint misses.
