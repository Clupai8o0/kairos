# Kairos — Base Project Setup (Session 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap an empty Next.js 16 (App Router) monorepo with TypeScript strict, Tailwind v4, Drizzle+Neon schema, Better Auth+Google OAuth, ESLint custom rules, `/api/health`, Vitest+msw, and route group scaffolding—matching the Kairos Session 1 definition of done.

**Architecture:** Single Next.js app, no separate backend. Drizzle schema is split by concern into `lib/db/schema/*.ts`. Better Auth owns auth tables; application tables are separate. Custom ESLint rules run at lint time to enforce the no-Project and no-LLM-provider-SDK invariants.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, pnpm, Drizzle ORM + drizzle-kit, @neondatabase/serverless, Better Auth, Zod, Vercel AI SDK, react-hook-form, TanStack Query 5, Zustand, Vitest, msw, framer-motion, gsap.

---

## File Map

| File | Purpose |
|---|---|
| `package.json` | All dependencies |
| `tsconfig.json` | TypeScript strict, path alias `@/*` |
| `next.config.ts` | Next.js configuration |
| `eslint.config.mjs` | Flat ESLint config + custom rules |
| `eslint-rules/no-project-entity.js` | Ban `Project`/`projectId` identifiers |
| `eslint-rules/no-llm-provider-imports.js` | Ban direct LLM provider imports |
| `drizzle.config.ts` | Drizzle-kit config |
| `vercel.json` | Cron declaration |
| `vitest.config.ts` | Vitest config |
| `vitest.setup.ts` | Global test setup (msw server) |
| `.env.local.example` | Env var template |
| `lib/db/client.ts` | Neon HTTP driver + Drizzle instance |
| `lib/db/schema/auth.ts` | Better Auth tables (`user`, `session`, `account`, `verification`) |
| `lib/db/schema/tasks.ts` | `tasks` table |
| `lib/db/schema/tags.ts` | `tags` + `taskTags` join table |
| `lib/db/schema/views.ts` | `views` table |
| `lib/db/schema/schedule.ts` | `blackoutDays` + `scheduleWindows` + `scheduleLogs` |
| `lib/db/schema/gcal.ts` | `googleAccounts` + `googleCalendars` |
| `lib/db/schema/jobs.ts` | `jobs` table (ADR-R9) |
| `lib/db/schema/scratchpad.ts` | `scratchpads` + `scratchpadPluginConfigs` + `pluginInstalls` |
| `lib/db/schema/index.ts` | Barrel re-export |
| `lib/auth/index.ts` | Better Auth instance |
| `lib/utils/id.ts` | CUID2 wrapper |
| `app/layout.tsx` | Root HTML shell |
| `app/globals.css` | Tailwind import + CSS variable tokens |
| `app/api/auth/[...all]/route.ts` | Better Auth catch-all handler |
| `app/api/health/route.ts` | DB connectivity smoke test |
| `app/(marketing)/layout.tsx` | Marketing layout (static) |
| `app/(marketing)/page.tsx` | Landing page placeholder |
| `app/(app)/layout.tsx` | App layout — redirects unauthenticated users |
| `app/(app)/dashboard/page.tsx` | Dashboard placeholder |
| `components/providers.tsx` | TanStack Query provider (client component) |
| `tests/unit/health.test.ts` | First passing unit test |

---

## Task 1: Bootstrap Next.js 16 App

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `.gitignore`

- [ ] **Step 1: Run create-next-app non-interactively**

```bash
cd /Users/clupa/Documents/projects/kairos/kairos
pnpm dlx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --eslint \
  --no-git \
  --yes
```

Expected output ends with: `Success! Created kairos` (or similar). If prompted about existing files (`CLAUDE.md`, etc.), choose to skip/keep them.

- [ ] **Step 2: Verify the scaffold**

```bash
ls -1
```

Expected: `app/`, `components/`, `node_modules/`, `package.json`, `tsconfig.json`, `next.config.ts` (or `.js`) present.

- [ ] **Step 3: Ensure TypeScript strict mode is on**

Open `tsconfig.json`. Confirm `"strict": true` is present under `compilerOptions`. If it's missing, add it:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Install additional runtime dependencies**

```bash
pnpm add \
  drizzle-orm \
  @neondatabase/serverless \
  better-auth \
  zod \
  ai \
  @tanstack/react-query \
  zustand \
  react-hook-form \
  @hookform/resolvers \
  framer-motion \
  gsap \
  @paralleldrive/cuid2
```

- [ ] **Step 5: Install dev dependencies**

```bash
pnpm add -D \
  drizzle-kit \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/jest-dom \
  msw \
  @types/node \
  vite-tsconfig-paths
```

- [ ] **Step 6: Verify build compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only type errors from scaffolded demo code—those get deleted later).

---

## Task 2: ESLint Custom Rules

**Files:**
- Create: `eslint-rules/no-project-entity.js`
- Create: `eslint-rules/no-llm-provider-imports.js`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Create `eslint-rules/no-project-entity.js`**

```javascript
// eslint-rules/no-project-entity.js
// Bans the identifier names Project, projectId, and projects as domain concepts.
// String literals and comments are intentionally not checked.
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Project entity — there is no Project concept in Kairos. Use tags.',
    },
  },
  create(context) {
    const FORBIDDEN = /^(Project|projectId|projects)$/;

    return {
      Identifier(node) {
        if (FORBIDDEN.test(node.name)) {
          context.report({
            node,
            message: `"${node.name}" is forbidden. Kairos has no Project entity — use tags instead (ADR-R7).`,
          });
        }
      },
    };
  },
};
```

- [ ] **Step 2: Create `eslint-rules/no-llm-provider-imports.js`**

```javascript
// eslint-rules/no-llm-provider-imports.js
// Bans direct LLM provider SDK imports outside lib/llm/ and lib/plugins/builtin/.
const FORBIDDEN = [
  'openai',
  '@anthropic-ai/sdk',
  '@anthropic-ai/bedrock-sdk',
  'cohere-ai',
  '@google/generative-ai',
  'groq-sdk',
  'mistralai',
  '@mistralai/mistralai',
];

const ALLOWED_PATH_FRAGMENTS = [
  '/lib/llm/',
  '/lib/plugins/builtin/',
];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct LLM provider SDK imports outside lib/llm/ and lib/plugins/builtin/ (ADR-R10).',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWED_PATH_FRAGMENTS.some((f) => filename.includes(f))) return {};

    return {
      ImportDeclaration(node) {
        const source = /** @type {string} */ (node.source.value);
        const forbidden = FORBIDDEN.find(
          (pkg) => source === pkg || source.startsWith(pkg + '/'),
        );
        if (forbidden) {
          context.report({
            node,
            message: `Direct import of "${source}" is forbidden outside lib/llm/ and lib/plugins/builtin/ (ADR-R10). Use PluginContext.complete() instead.`,
          });
        }
      },
    };
  },
};
```

- [ ] **Step 3: Update `eslint.config.mjs` to load custom rules**

Replace the contents with:

```javascript
// eslint.config.mjs
import { createRequire } from 'module';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const noProjectEntity = require('./eslint-rules/no-project-entity.js');
const noLlmProviderImports = require('./eslint-rules/no-llm-provider-imports.js');

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: {
      kairos: {
        rules: {
          'no-project-entity': noProjectEntity,
          'no-llm-provider-imports': noLlmProviderImports,
        },
      },
    },
    rules: {
      'kairos/no-project-entity': 'error',
      'kairos/no-llm-provider-imports': 'error',
    },
  },
];

export default config;
```

- [ ] **Step 4: Verify the custom rules load**

```bash
pnpm eslint --print-config app/layout.tsx 2>&1 | grep -E 'no-project|no-llm'
```

Expected output includes lines like `"kairos/no-project-entity": ["error"]` and `"kairos/no-llm-provider-imports": ["error"]`.

- [ ] **Step 5: Verify the rules catch violations**

Create a temp file and lint it:

```bash
echo 'const projectId = 1;' > /tmp/test-lint.ts
pnpm eslint /tmp/test-lint.ts --rule '{"kairos/no-project-entity": "error"}' --rulesdir eslint-rules 2>&1 || true
```

Expected: error output mentioning `"projectId" is forbidden`.

```bash
rm /tmp/test-lint.ts
```

---

## Task 3: Drizzle Config + DB Client

**Files:**
- Create: `drizzle.config.ts`
- Create: `lib/db/client.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 2: Create `lib/db/client.ts`**

```typescript
// lib/db/client.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
export type DB = typeof db;
```

---

## Task 4: CUID2 Utility

**Files:**
- Create: `lib/utils/id.ts`

- [ ] **Step 1: Create `lib/utils/id.ts`**

```typescript
// lib/utils/id.ts
import { createId } from '@paralleldrive/cuid2';

/** Generate a new CUID2 for use as a primary key. */
export const newId = createId;
```

---

## Task 5: Drizzle Schema — Auth Tables

**Files:**
- Create: `lib/db/schema/auth.ts`

Better Auth uses specific table names. The Drizzle adapter maps them from the schema passed in; here we define the tables Better Auth will read/write.

- [ ] **Step 1: Create `lib/db/schema/auth.ts`**

```typescript
// lib/db/schema/auth.ts
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

## Task 6: Drizzle Schema — Tasks

**Files:**
- Create: `lib/db/schema/tasks.ts`

- [ ] **Step 1: Create `lib/db/schema/tasks.ts`**

```typescript
// lib/db/schema/tasks.ts
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Core
  title: text('title').notNull(),
  description: text('description'),
  durationMins: integer('duration_mins'),

  // Scheduling inputs
  deadline: timestamp('deadline'),
  priority: integer('priority').notNull().default(3), // 1=urgent..4=low
  status: text('status')
    .$type<'pending' | 'scheduled' | 'in_progress' | 'done' | 'cancelled'>()
    .notNull()
    .default('pending'),
  schedulable: boolean('schedulable').notNull().default(true),

  // GCal reference — only time-related fields (ADR-003)
  gcalEventId: text('gcal_event_id'),
  scheduledAt: timestamp('scheduled_at'),
  scheduledEnd: timestamp('scheduled_end'),

  // Flexibility
  bufferMins: integer('buffer_mins').notNull().default(15),
  minChunkMins: integer('min_chunk_mins'),
  isSplittable: boolean('is_splittable').notNull().default(false),

  // Dependencies
  dependsOn: text('depends_on')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  // Recurrence
  recurrenceRule: jsonb('recurrence_rule'),
  parentTaskId: text('parent_task_id'),
  recurrenceIndex: integer('recurrence_index'),

  // Provenance
  source: text('source'), // 'manual' | 'scratchpad:builtin-text' | etc.
  sourceRef: text('source_ref'),
  sourceMetadata: jsonb('source_metadata').notNull().default(sql`'{}'::jsonb`),

  // Bookkeeping
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

---

## Task 7: Drizzle Schema — Tags

**Files:**
- Create: `lib/db/schema/tags.ts`

- [ ] **Step 1: Create `lib/db/schema/tags.ts`**

```typescript
// lib/db/schema/tags.ts
import { pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { tasks } from './tasks';

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userNameUniq: unique('tags_user_name_uniq').on(t.userId, t.name),
  }),
);

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.tagId] }),
  }),
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
```

---

## Task 8: Drizzle Schema — Views

**Files:**
- Create: `lib/db/schema/views.ts`

- [ ] **Step 1: Create `lib/db/schema/views.ts`**

```typescript
// lib/db/schema/views.ts
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const views = pgTable('views', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull().default(sql`'{}'::jsonb`),
  sort: jsonb('sort').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type View = typeof views.$inferSelect;
export type NewView = typeof views.$inferInsert;
```

---

## Task 9: Drizzle Schema — Schedule

**Files:**
- Create: `lib/db/schema/schedule.ts`

- [ ] **Step 1: Create `lib/db/schema/schedule.ts`**

```typescript
// lib/db/schema/schedule.ts
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const blackoutDays = pgTable('blackout_days', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  date: timestamp('date', { mode: 'date' }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const scheduleWindows = pgTable('schedule_windows', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday .. 6=Saturday
  startTime: text('start_time').notNull(), // 'HH:MM' 24h
  endTime: text('end_time').notNull(),     // 'HH:MM' 24h
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const scheduleLogs = pgTable('schedule_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  runType: text('run_type')
    .$type<'single-task' | 'full-run'>()
    .notNull(),
  taskId: text('task_id'), // null for full-run
  status: text('status')
    .$type<'success' | 'partial' | 'failed'>()
    .notNull(),
  tasksScheduled: integer('tasks_scheduled').notNull().default(0),
  durationMs: integer('duration_ms'),
  error: text('error'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

---

## Task 10: Drizzle Schema — Google Calendar

**Files:**
- Create: `lib/db/schema/gcal.ts`

- [ ] **Step 1: Create `lib/db/schema/gcal.ts`**

```typescript
// lib/db/schema/gcal.ts
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const googleAccounts = pgTable('google_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  googleAccountId: text('google_account_id').notNull(),
  email: text('email').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const googleCalendars = pgTable('google_calendars', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  googleAccountId: text('google_account_id')
    .notNull()
    .references(() => googleAccounts.id, { onDelete: 'cascade' }),
  calendarId: text('calendar_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  selected: boolean('selected').notNull().default(false),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

## Task 11: Drizzle Schema — Jobs

**Files:**
- Create: `lib/db/schema/jobs.ts`

- [ ] **Step 1: Create `lib/db/schema/jobs.ts`**

```typescript
// lib/db/schema/jobs.ts
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    status: text('status')
      .$type<'pending' | 'running' | 'done' | 'failed' | 'dead'>()
      .notNull()
      .default('pending'),
    runAfter: timestamp('run_after').notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    // Partial unique index: idempotency_key IS NOT NULL (ADR-R9)
    idempotencyKeyIdx: uniqueIndex('jobs_idempotency_key_idx')
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  }),
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
```

---

## Task 12: Drizzle Schema — Scratchpad

**Files:**
- Create: `lib/db/schema/scratchpad.ts`

- [ ] **Step 1: Create `lib/db/schema/scratchpad.ts`**

```typescript
// lib/db/schema/scratchpad.ts
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const scratchpads = pgTable('scratchpads', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title'),
  content: text('content').notNull().default(''),
  inputType: text('input_type').notNull().default('text'), // 'text'|'url'|'share'|'voice'
  inputPayload: jsonb('input_payload').notNull().default(sql`'{}'::jsonb`),
  pluginName: text('plugin_name'),
  pluginVersion: text('plugin_version'),
  processed: boolean('processed').notNull().default(false),
  parseResult: jsonb('parse_result'),
  extractedTaskIds: text('extracted_task_ids')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const scratchpadPluginConfigs = pgTable(
  'scratchpad_plugin_configs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    pluginName: text('plugin_name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    memory: jsonb('memory').notNull().default(sql`'{}'::jsonb`),
    rulesets: jsonb('rulesets').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userPluginUniq: unique('scratchpad_plugin_configs_user_plugin_uniq').on(
      t.userId,
      t.pluginName,
    ),
  }),
);

export const pluginInstalls = pgTable('plugin_installs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  pluginName: text('plugin_name').notNull(),
  pluginVersion: text('plugin_version').notNull(),
  source: text('source')
    .$type<'builtin' | 'npm' | 'http' | 'git'>()
    .notNull(),
  sourceUrl: text('source_url'),
  enabled: boolean('enabled').notNull().default(true),
  installedAt: timestamp('installed_at').notNull().defaultNow(),
});
```

---

## Task 13: Schema Barrel Export

**Files:**
- Create: `lib/db/schema/index.ts`

- [ ] **Step 1: Create `lib/db/schema/index.ts`**

```typescript
// lib/db/schema/index.ts
export * from './auth';
export * from './tasks';
export * from './tags';
export * from './views';
export * from './schedule';
export * from './gcal';
export * from './jobs';
export * from './scratchpad';
```

- [ ] **Step 2: Verify the schema compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors from `lib/db/schema/**`.

---

## Task 14: Better Auth Instance

**Files:**
- Create: `lib/auth/index.ts`

- [ ] **Step 1: Create `lib/auth/index.ts`**

```typescript
// lib/auth/index.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar',
      ],
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Auth = typeof auth;
```

- [ ] **Step 2: Create the Better Auth catch-all route handler**

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth.handler);
```

---

## Task 15: Health Route

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Create `app/api/health/route.ts`**

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', db: 'disconnected', error: String(error) },
      { status: 503 },
    );
  }
}
```

---

## Task 16: Route Group Scaffolding

**Files:**
- Create: `app/(marketing)/layout.tsx`
- Create: `app/(marketing)/page.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/dashboard/page.tsx`
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create TanStack Query provider**

```tsx
// components/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Step 2: Update root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Kairos',
  description: 'AI-native scheduling and task management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create marketing layout**

```tsx
// app/(marketing)/layout.tsx
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Create marketing landing page placeholder**

```tsx
// app/(marketing)/page.tsx
export default function LandingPage() {
  return (
    <main>
      <h1>Kairos</h1>
      <p>AI-native scheduling. Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 5: Create app layout with auth guard**

```tsx
// app/(app)/layout.tsx
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Providers } from '@/components/providers';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/');
  }

  return <>{children}</>;
}
```

- [ ] **Step 6: Create dashboard placeholder**

```tsx
// app/(app)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Kairos — authenticated.</p>
    </main>
  );
}
```

- [ ] **Step 7: Remove the default Next.js `app/page.tsx` scaffold content**

Replace `app/page.tsx` with a redirect to the marketing page (or just remove it since `(marketing)/page.tsx` handles `/`):

```tsx
// app/page.tsx — forward to marketing group's root
export { default } from './(marketing)/page';
```

Actually, Next.js route groups mean `app/(marketing)/page.tsx` *is* the `/` route. The top-level `app/page.tsx` created by create-next-app conflicts with it. Delete it:

```bash
rm app/page.tsx
```

---

## Task 17: Environment Config

**Files:**
- Create: `.env.local.example`
- Create: `vercel.json`

- [ ] **Step 1: Create `.env.local.example`**

```bash
# .env.local.example
# Copy to .env.local and fill in values before running locally.

# --- Database ---
# Neon Postgres connection string (get from neon.tech)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# --- Better Auth ---
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=

# App origin (no trailing slash). Used for CORS + callback URLs.
BETTER_AUTH_URL=http://localhost:3000

# --- Google OAuth ---
# Create at console.cloud.google.com → APIs & Services → Credentials
# Scopes needed: openid, email, profile, https://www.googleapis.com/auth/calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- App mode ---
# 'self-hosted' (default) | 'hosted'
# Self-hosted never loads billing/rate-limit code (ADR-R12).
KAIROS_MODE=self-hosted
```

- [ ] **Step 2: Ensure `.env.local` is in `.gitignore`**

```bash
grep -q '.env.local' .gitignore || echo '.env.local' >> .gitignore
```

Expected: either already present, or appended.

- [ ] **Step 3: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/drain",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## Task 18: Vitest + msw Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `tests/unit/health.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```typescript
// vitest.setup.ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

// Export so individual tests can add handlers
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 3: Add test script to `package.json`**

Open `package.json` and add `"test": "vitest run"` and `"test:watch": "vitest"` to the `scripts` object:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 4: Create the first passing test**

```typescript
// tests/unit/health.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe('GET /api/health', () => {
  it('returns 200 with db:connected when the query succeeds', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.execute).mockResolvedValue([] as never);

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', db: 'connected' });
  });

  it('returns 503 with db:disconnected when the query throws', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.execute).mockRejectedValueOnce(
      new Error('connection refused'),
    );

    // Re-import to get a fresh module resolution (mocks are module-level)
    vi.resetModules();
    vi.mock('@/lib/db/client', () => ({
      db: { execute: vi.fn().mockRejectedValue(new Error('connection refused')) },
    }));
    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.db).toBe('disconnected');
  });
});
```

- [ ] **Step 5: Run the tests**

```bash
pnpm test
```

Expected:
```
✓ tests/unit/health.test.ts (2)
  ✓ GET /api/health > returns 200 with db:connected when the query succeeds
  ✓ GET /api/health > returns 503 with db:disconnected when the query throws

Test Files  1 passed (1)
Tests       2 passed (2)
```

---

## Task 19: Generate First Migration

**Files:**
- Create: `drizzle/` (generated)

Prerequisites: `DATABASE_URL` set in `.env.local` pointing to a real Neon DB.

- [ ] **Step 1: Generate migration SQL**

```bash
pnpm db:generate
```

Expected: creates `drizzle/0000_initial.sql` (or similar). If schema is valid, no errors.

- [ ] **Step 2: Apply migration to Neon**

```bash
pnpm db:migrate
```

Expected: `Migration applied` (or similar). No errors.

- [ ] **Step 3: Confirm the health endpoint works**

```bash
pnpm dev &
sleep 5
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","db":"connected"}`

```bash
kill %1  # stop dev server
```

---

## Task 20: Lint + Type Check

- [ ] **Step 1: Run TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run ESLint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

---

## Task 21: Update CHANGELOG.md

- [ ] **Step 1: Append session log to `CHANGELOG.md`**

Add the following to the top of the **Sessions** section:

```markdown
## 2026-04-15 — Session 1: Base project setup

**Goal for this session:** Bootstrap the Next.js 16 app with TypeScript strict, Tailwind v4, Drizzle+Neon, Better Auth+Google OAuth, ESLint custom rules, `/api/health`, Vitest+msw, and route group scaffolding.

**Built:**
- `pnpm create next-app` baseline with TypeScript strict + Tailwind v4 + App Router
- ESLint custom rules: `no-project-entity` (ban `Project`/`projectId`) + `no-llm-provider-imports` (ban direct provider SDKs outside `lib/llm/` and `lib/plugins/builtin/`)
- Drizzle + @neondatabase/serverless wired to Neon; `drizzle.config.ts` pointing at `lib/db/schema/index.ts`
- Full Drizzle schema: `user`, `session`, `account`, `verification`, `tasks`, `tags`, `taskTags`, `views`, `blackoutDays`, `scheduleWindows`, `scheduleLogs`, `googleAccounts`, `googleCalendars`, `jobs`, `scratchpads`, `scratchpadPluginConfigs`, `pluginInstalls`
- Better Auth + Google OAuth (single flow grants app login + GCal scopes)
- `/api/auth/[...all]` catch-all handler
- `/api/health` — DB connectivity smoke test
- `vitest.config.ts` + `vitest.setup.ts` (msw server)
- `tests/unit/health.test.ts` — 2 passing tests
- `app/(marketing)/` route group with placeholder landing page
- `app/(app)/` route group with auth guard + placeholder dashboard
- `components/providers.tsx` — TanStack Query provider
- `vercel.json` — cron declaration for `/api/cron/drain`
- `.env.local.example`
- `lib/utils/id.ts` — CUID2 wrapper

**Decisions made:**
- No decision changed from ADRs. All decisions follow ADR-001 through ADR-R13.

**Files touched:** ~30 files created

**Tests added:** 2

**Next action:**
- Session 2: Tasks CRUD — `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` + Tags CRUD + Views CRUD, service layer under `lib/services/`, integration tests via msw.
```

- [ ] **Step 2: Tick off Session 1 items in CHANGELOG.md "Built" checklist**

Mark these as done in the Current State section:
- `[x] pnpm create next-app baseline with TypeScript strict + Tailwind v4 + App Router`
- `[x] ESLint config with custom rules`
- `[x] Drizzle setup + Neon connection`
- `[x] Better Auth + Google OAuth`
- `[x] Drizzle schema for all required tables`
- `[x] Initial migration applied to a fresh DB`
- `[x] Smoke-test route handler at /api/health`
- `[x] Vitest + msw setup with one passing test`
- `[x] Marketing route group scaffolded`
- `[x] App route group scaffolded`

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| `pnpm create next-app` baseline TypeScript strict + Tailwind v4 + App Router | Task 1 |
| ESLint custom rules: ban `Project`/`projectId` | Task 2 |
| ESLint custom rules: ban direct LLM provider imports | Task 2 |
| Drizzle + Neon connection | Task 3 |
| Better Auth + Google OAuth (one flow, GCal scopes) | Task 14 |
| `users` table | Task 5 (Better Auth `user`) |
| `tasks` table — no `projectId` | Task 6 |
| `tags` + `taskTags` | Task 7 |
| `views` | Task 8 |
| `googleAccounts`, `googleCalendars` | Task 10 |
| `blackoutDays`, `scheduleWindows`, `scheduleLogs` | Task 9 |
| `jobs` table (ADR-R9) + partial unique index on `idempotencyKey` | Task 11 |
| `scratchpads`, `scratchpadPluginConfigs`, `pluginInstalls` | Task 12 |
| Better Auth tables | Task 5 |
| Initial migration applied | Task 19 |
| `/api/health` route | Task 15 |
| Vitest + msw with one passing test | Task 18 |
| Marketing route group placeholder | Task 16 |
| App route group placeholder with auth | Task 16 |
| `vercel.json` cron config | Task 17 |
| `.env.local.example` | Task 17 |

No gaps found.

### Placeholder scan

No TBD, TODO, "implement later", or "similar to Task N" placeholders found.

### Type consistency

- `db.execute` is `vi.mocked` using the same `db` import path (`@/lib/db/client`) throughout.
- Better Auth's `auth.api.getSession` signature used consistently in `app/(app)/layout.tsx` and nowhere else in this plan.
- `toNextJsHandler(auth.handler)` — Better Auth's Next.js helper takes `auth.handler`, not `auth` directly. This matches Better Auth ≥1.0 API.
