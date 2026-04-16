# Kairos Session 2 — Tasks/Tags/Views/Calendars CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full CRUD for tasks (with tags), tags, views, and a calendar list/select endpoint, each with route handlers, a service layer, and integration tests—bringing Phase 1 to feature-complete on the backend.

**Architecture:** Route handlers parse + auth + delegate only (≤80 lines). Services own all DB logic (≤200 lines). Integration tests mock services and auth helper directly—fast, no real DB needed. Each feature group is committed independently.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Drizzle ORM 0.45, Better Auth 1.6.4, Zod 4, Vitest 4, @paralleldrive/cuid2.

---

## File Map

| File | Purpose |
|---|---|
| `lib/auth/helpers.ts` | `requireAuth()` — returns `{ userId }` or `Response(401)` |
| `lib/services/tasks.ts` | `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask` |
| `app/api/tasks/route.ts` | `GET` (list), `POST` (create) |
| `app/api/tasks/[id]/route.ts` | `GET`, `PATCH`, `DELETE` |
| `tests/integration/tasks.test.ts` | Route handler tests — mocked services |
| `lib/services/tags.ts` | `listTags`, `getTag`, `createTag`, `updateTag`, `deleteTag` |
| `app/api/tags/route.ts` | `GET`, `POST` |
| `app/api/tags/[id]/route.ts` | `GET`, `PATCH`, `DELETE` |
| `tests/integration/tags.test.ts` | Route handler tests |
| `lib/services/views.ts` | `listViews`, `getView`, `createView`, `updateView`, `deleteView` |
| `app/api/views/route.ts` | `GET`, `POST` |
| `app/api/views/[id]/route.ts` | `GET`, `PATCH`, `DELETE` |
| `tests/integration/views.test.ts` | Route handler tests |
| `lib/services/calendars.ts` | `listCalendars`, `setCalendarSelected` |
| `app/api/calendars/route.ts` | `GET` (list) |
| `app/api/calendars/[id]/route.ts` | `PATCH` (select/deselect) |
| `tests/integration/calendars.test.ts` | Route handler tests |

---

## Task 1: Auth Helper

**Files:**
- Create: `lib/auth/helpers.ts`

- [ ] **Step 1: Create `lib/auth/helpers.ts`**

```typescript
// lib/auth/helpers.ts
import { auth } from './index';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Call at the top of every route handler.
 * Returns { userId } on success, or a 401 Response to return immediately.
 *
 * Usage:
 *   const authResult = await requireAuth();
 *   if (authResult instanceof Response) return authResult;
 *   const { userId } = authResult;
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId: session.user.id };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/clupa/Documents/projects/kairos/kairos
pnpm tsc --noEmit
```

Expected: 0 errors.

---

## Task 2: Tasks Service

**Files:**
- Create: `lib/services/tasks.ts`

- [ ] **Step 1: Create `lib/services/tasks.ts`**

```typescript
// lib/services/tasks.ts
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { taskTags, tags, tasks } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskWithTags = typeof tasks.$inferSelect & {
  tags: { id: string; name: string; color: string | null }[];
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  durationMins?: number;
  deadline?: string;          // ISO 8601 string
  priority: number;
  schedulable: boolean;
  bufferMins: number;
  minChunkMins?: number;
  isSplittable: boolean;
  dependsOn: string[];
  recurrenceRule?: Record<string, unknown>;
  tagIds: string[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  durationMins?: number;
  deadline?: string | null;
  priority?: number;
  status?: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';
  schedulable?: boolean;
  bufferMins?: number;
  minChunkMins?: number | null;
  isSplittable?: boolean;
  dependsOn?: string[];
  recurrenceRule?: Record<string, unknown> | null;
  tagIds?: string[];
};

export type ListTasksFilters = {
  status?: string;
  priority?: number;
  tagId?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function attachTags(rows: (typeof tasks.$inferSelect)[]): Promise<TaskWithTags[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((t) => t.id);
  const tagRows = await db
    .select({ taskId: taskTags.taskId, id: tags.id, name: tags.name, color: tags.color })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, ids));

  const byTask = new Map<string, { id: string; name: string; color: string | null }[]>();
  for (const r of tagRows) {
    const list = byTask.get(r.taskId) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color });
    byTask.set(r.taskId, list);
  }
  return rows.map((t) => ({ ...t, tags: byTask.get(t.id) ?? [] }));
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function listTasks(userId: string, filters: ListTasksFilters = {}): Promise<TaskWithTags[]> {
  const conditions = [eq(tasks.userId, userId)];
  if (filters.status) conditions.push(eq(tasks.status, filters.status as TaskWithTags['status']));
  if (filters.priority !== undefined) conditions.push(eq(tasks.priority, filters.priority));

  let rows = await db.select().from(tasks).where(and(...conditions));

  if (filters.tagId) {
    const linked = await db
      .select({ taskId: taskTags.taskId })
      .from(taskTags)
      .where(eq(taskTags.tagId, filters.tagId));
    const linkedIds = new Set(linked.map((r) => r.taskId));
    rows = rows.filter((t) => linkedIds.has(t.id));
  }

  return attachTags(rows);
}

export async function getTask(userId: string, id: string): Promise<TaskWithTags | null> {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (!row) return null;
  const [withTags] = await attachTags([row]);
  return withTags;
}

export async function createTask(userId: string, input: CreateTaskInput): Promise<TaskWithTags> {
  const { tagIds, deadline, recurrenceRule, ...rest } = input;
  const id = newId();
  await db.insert(tasks).values({
    id,
    userId,
    ...rest,
    deadline: deadline ? new Date(deadline) : undefined,
    recurrenceRule: recurrenceRule ?? undefined,
    updatedAt: new Date(),
  });
  if (tagIds.length > 0) {
    await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: id, tagId })));
  }
  return (await getTask(userId, id))!;
}

export async function updateTask(
  userId: string,
  id: string,
  input: UpdateTaskInput,
): Promise<TaskWithTags | null> {
  const { tagIds, deadline, recurrenceRule, ...rest } = input;

  const patch: Partial<typeof tasks.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (deadline !== undefined) patch.deadline = deadline ? new Date(deadline) : null;
  if (recurrenceRule !== undefined) patch.recurrenceRule = recurrenceRule ?? null;

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  if (!updated) return null;

  if (tagIds !== undefined) {
    await db.delete(taskTags).where(eq(taskTags.taskId, id));
    if (tagIds.length > 0) {
      await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: id, tagId })));
    }
  }
  return getTask(userId, id);
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return !!deleted;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

---

## Task 3: Tasks Route Handlers

**Files:**
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Create `app/api/tasks/route.ts`**

```typescript
// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createTask, listTasks } from '@/lib/services/tasks';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  durationMins: z.number().int().positive().optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  priority: z.number().int().min(1).max(4).default(3),
  schedulable: z.boolean().default(true),
  bufferMins: z.number().int().min(0).default(15),
  minChunkMins: z.number().int().positive().optional(),
  isSplittable: z.boolean().default(false),
  dependsOn: z.array(z.string()).default([]),
  recurrenceRule: z.record(z.unknown()).optional(),
  tagIds: z.array(z.string()).default([]),
});

const ListTasksSchema = z.object({
  status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.coerce.number().int().min(1).max(4).optional(),
  tagId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const parsed = ListTasksSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await listTasks(userId, parsed.data);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const task = await createTask(userId, parsed.data);
  return NextResponse.json(task, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/tasks/[id]/route.ts`**

```typescript
// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteTask, getTask, updateTask } from '@/lib/services/tasks';

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  durationMins: z.number().int().positive().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled']).optional(),
  schedulable: z.boolean().optional(),
  bufferMins: z.number().int().min(0).optional(),
  minChunkMins: z.number().int().positive().nullable().optional(),
  isSplittable: z.boolean().optional(),
  dependsOn: z.array(z.string()).optional(),
  recurrenceRule: z.record(z.unknown()).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const task = await getTask(userId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const task = await updateTask(userId, id, parsed.data);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteTask(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

---

## Task 4: Tasks Integration Tests

**Files:**
- Create: `tests/integration/tasks.test.ts`

- [ ] **Step 1: Create `tests/integration/tasks.test.ts`**

```typescript
// tests/integration/tasks.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/services/tasks', () => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user-test-1';

const MOCK_TASK = {
  id: 'task-1',
  userId: MOCK_USER_ID,
  title: 'Write tests',
  description: null,
  durationMins: 30,
  deadline: null,
  priority: 2,
  status: 'pending' as const,
  schedulable: true,
  gcalEventId: null,
  scheduledAt: null,
  scheduledEnd: null,
  bufferMins: 15,
  minChunkMins: null,
  isSplittable: false,
  dependsOn: [],
  recurrenceRule: null,
  parentTaskId: null,
  recurrenceIndex: null,
  source: null,
  sourceRef: null,
  sourceMetadata: {},
  completedAt: null,
  metadata: {},
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
  tags: [{ id: 'tag-1', name: 'work', color: '#3b82f6' }],
};

function authedUser() {
  const { requireAuth } = vi.mocked(await import('@/lib/auth/helpers'));
  requireAuth.mockResolvedValue({ userId: MOCK_USER_ID });
}

function unauthenticated() {
  const { requireAuth } = vi.mocked(await import('@/lib/auth/helpers'));
  requireAuth.mockResolvedValue(
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  );
}

function jsonRequest(url: string, opts?: { method?: string; body?: unknown }) {
  return new NextRequest(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/auth/helpers');
    vi.mocked(requireAuth).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    const { GET } = await import('@/app/api/tasks/route');
    const res = await GET(jsonRequest('http://localhost/api/tasks'));
    expect(res.status).toBe(401);
  });

  it('returns task list for authenticated user', async () => {
    const { requireAuth } = await import('@/lib/auth/helpers');
    vi.mocked(requireAuth).mockResolvedValue({ userId: MOCK_USER_ID });
    const { listTasks } = await import('@/lib/services/tasks');
    vi.mocked(listTasks).mockResolvedValue([MOCK_TASK]);

    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ listTasks: vi.fn().mockResolvedValue([MOCK_TASK]), createTask: vi.fn() }));

    const { GET } = await import('@/app/api/tasks/route');
    const res = await GET(jsonRequest('http://localhost/api/tasks'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('task-1');
  });

  it('returns 400 for invalid status query param', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ listTasks: vi.fn(), createTask: vi.fn() }));

    const { GET } = await import('@/app/api/tasks/route');
    const res = await GET(jsonRequest('http://localhost/api/tasks?status=invalid'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      ),
    }));
    vi.mock('@/lib/services/tasks', () => ({ listTasks: vi.fn(), createTask: vi.fn() }));

    const { POST } = await import('@/app/api/tasks/route');
    const res = await POST(jsonRequest('http://localhost/api/tasks', { method: 'POST', body: { title: 'Test' } }));
    expect(res.status).toBe(401);
  });

  it('creates a task and returns 201', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ listTasks: vi.fn(), createTask: vi.fn().mockResolvedValue(MOCK_TASK) }));

    const { POST } = await import('@/app/api/tasks/route');
    const res = await POST(
      jsonRequest('http://localhost/api/tasks', { method: 'POST', body: { title: 'Write tests', priority: 2 } }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('task-1');
    expect(body.tags).toHaveLength(1);
  });

  it('returns 400 when title is missing', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ listTasks: vi.fn(), createTask: vi.fn() }));

    const { POST } = await import('@/app/api/tasks/route');
    const res = await POST(
      jsonRequest('http://localhost/api/tasks', { method: 'POST', body: { priority: 2 } }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns task by id', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ getTask: vi.fn().mockResolvedValue(MOCK_TASK), updateTask: vi.fn(), deleteTask: vi.fn() }));

    const { GET } = await import('@/app/api/tasks/[id]/route');
    const res = await GET(
      jsonRequest('http://localhost/api/tasks/task-1'),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('task-1');
  });

  it('returns 404 for non-existent task', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ getTask: vi.fn().mockResolvedValue(null), updateTask: vi.fn(), deleteTask: vi.fn() }));

    const { GET } = await import('@/app/api/tasks/[id]/route');
    const res = await GET(
      jsonRequest('http://localhost/api/tasks/ghost'),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates task and returns 200', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({
      getTask: vi.fn(),
      updateTask: vi.fn().mockResolvedValue({ ...MOCK_TASK, title: 'Updated' }),
      deleteTask: vi.fn(),
    }));

    const { PATCH } = await import('@/app/api/tasks/[id]/route');
    const res = await PATCH(
      jsonRequest('http://localhost/api/tasks/task-1', { method: 'PATCH', body: { title: 'Updated' } }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated');
  });

  it('returns 404 when task not found', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ getTask: vi.fn(), updateTask: vi.fn().mockResolvedValue(null), deleteTask: vi.fn() }));

    const { PATCH } = await import('@/app/api/tasks/[id]/route');
    const res = await PATCH(
      jsonRequest('http://localhost/api/tasks/ghost', { method: 'PATCH', body: { title: 'x' } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status value', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ getTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn() }));

    const { PATCH } = await import('@/app/api/tasks/[id]/route');
    const res = await PATCH(
      jsonRequest('http://localhost/api/tasks/task-1', { method: 'PATCH', body: { status: 'flying' } }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 204 on success', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ getTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn().mockResolvedValue(true) }));

    const { DELETE } = await import('@/app/api/tasks/[id]/route');
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/task-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(204);
  });

  it('returns 404 when task not found', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tasks', () => ({ getTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn().mockResolvedValue(false) }));

    const { DELETE } = await import('@/app/api/tasks/[id]/route');
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/ghost', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test tests/integration/tasks.test.ts
```

Expected: all tests pass. If `vi.resetModules()` causes import issues, the pattern to use is a top-level `vi.mock` with `vi.mocked(...).mockResolvedValue(...)` in each test using `beforeEach(() => vi.clearAllMocks())`.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (existing health tests + new tasks tests).

- [ ] **Step 4: Commit**

```bash
cd /Users/clupa/Documents/projects/kairos/kairos
git init  # only if not already a git repo
git add lib/auth/helpers.ts lib/services/tasks.ts app/api/tasks/ tests/integration/tasks.test.ts
git commit -m "feat: tasks CRUD — service, route handlers, integration tests"
```

---

## Task 5: Tags Service + Route Handlers + Tests

**Files:**
- Create: `lib/services/tags.ts`
- Create: `app/api/tags/route.ts`
- Create: `app/api/tags/[id]/route.ts`
- Create: `tests/integration/tags.test.ts`

- [ ] **Step 1: Create `lib/services/tags.ts`**

```typescript
// lib/services/tags.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tags } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type Tag = typeof tags.$inferSelect;

export type CreateTagInput = {
  name: string;
  color?: string;
};

export type UpdateTagInput = {
  name?: string;
  color?: string | null;
};

export async function listTags(userId: string): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.userId, userId));
}

export async function getTag(userId: string, id: string): Promise<Tag | null> {
  const [row] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
  return row ?? null;
}

export async function createTag(userId: string, input: CreateTagInput): Promise<Tag> {
  const [row] = await db
    .insert(tags)
    .values({ id: newId(), userId, ...input, updatedAt: new Date() })
    .returning();
  return row;
}

export async function updateTag(userId: string, id: string, input: UpdateTagInput): Promise<Tag | null> {
  const [row] = await db
    .update(tags)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteTag(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning({ id: tags.id });
  return !!deleted;
}
```

- [ ] **Step 2: Create `app/api/tags/route.ts`**

```typescript
// app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createTag, listTags } from '@/lib/services/tags';

const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listTags(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateTagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await createTag(userId, parsed.data);
  return NextResponse.json(tag, { status: 201 });
}
```

- [ ] **Step 3: Create `app/api/tags/[id]/route.ts`**

```typescript
// app/api/tags/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteTag, getTag, updateTag } from '@/lib/services/tags';

const UpdateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const tag = await getTag(userId, id);
  if (!tag) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tag);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateTagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await updateTag(userId, id, parsed.data);
  if (!tag) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tag);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteTag(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Create `tests/integration/tags.test.ts`**

```typescript
// tests/integration/tags.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_USER_ID = 'user-test-1';
const MOCK_TAG = {
  id: 'tag-1',
  userId: MOCK_USER_ID,
  name: 'work',
  color: '#3b82f6',
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
};

function req(url: string, opts?: { method?: string; body?: unknown }) {
  return new NextRequest(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe('GET /api/tags', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    }));
    vi.mock('@/lib/services/tags', () => ({ listTags: vi.fn(), createTag: vi.fn() }));

    const { GET } = await import('@/app/api/tags/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns tag list', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ listTags: vi.fn().mockResolvedValue([MOCK_TAG]), createTag: vi.fn() }));

    const { GET } = await import('@/app/api/tags/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe('work');
  });
});

describe('POST /api/tags', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates tag and returns 201', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ listTags: vi.fn(), createTag: vi.fn().mockResolvedValue(MOCK_TAG) }));

    const { POST } = await import('@/app/api/tags/route');
    const res = await POST(req('http://localhost/api/tags', { method: 'POST', body: { name: 'work', color: '#3b82f6' } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('work');
  });

  it('returns 400 when name is missing', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ listTags: vi.fn(), createTag: vi.fn() }));

    const { POST } = await import('@/app/api/tags/route');
    const res = await POST(req('http://localhost/api/tags', { method: 'POST', body: {} }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tags/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns tag by id', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ getTag: vi.fn().mockResolvedValue(MOCK_TAG), updateTag: vi.fn(), deleteTag: vi.fn() }));

    const { GET } = await import('@/app/api/tags/[id]/route');
    const res = await GET(req('http://localhost/api/tags/tag-1'), { params: Promise.resolve({ id: 'tag-1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing tag', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ getTag: vi.fn().mockResolvedValue(null), updateTag: vi.fn(), deleteTag: vi.fn() }));

    const { GET } = await import('@/app/api/tags/[id]/route');
    const res = await GET(req('http://localhost/api/tags/ghost'), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tags/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates tag and returns 200', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ getTag: vi.fn(), updateTag: vi.fn().mockResolvedValue({ ...MOCK_TAG, name: 'personal' }), deleteTag: vi.fn() }));

    const { PATCH } = await import('@/app/api/tags/[id]/route');
    const res = await PATCH(
      req('http://localhost/api/tags/tag-1', { method: 'PATCH', body: { name: 'personal' } }),
      { params: Promise.resolve({ id: 'tag-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('personal');
  });

  it('returns 404 when tag not found', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ getTag: vi.fn(), updateTag: vi.fn().mockResolvedValue(null), deleteTag: vi.fn() }));

    const { PATCH } = await import('@/app/api/tags/[id]/route');
    const res = await PATCH(
      req('http://localhost/api/tags/ghost', { method: 'PATCH', body: { name: 'x' } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tags/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 204 on success', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ getTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn().mockResolvedValue(true) }));

    const { DELETE } = await import('@/app/api/tags/[id]/route');
    const res = await DELETE(req('http://localhost/api/tags/tag-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'tag-1' }) });
    expect(res.status).toBe(204);
  });

  it('returns 404 when tag not found', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/tags', () => ({ getTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn().mockResolvedValue(false) }));

    const { DELETE } = await import('@/app/api/tags/[id]/route');
    const res = await DELETE(req('http://localhost/api/tags/ghost', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test tests/integration/tags.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/services/tags.ts app/api/tags/ tests/integration/tags.test.ts
git commit -m "feat: tags CRUD — service, route handlers, integration tests"
```

---

## Task 6: Views Service + Route Handlers + Tests

**Files:**
- Create: `lib/services/views.ts`
- Create: `app/api/views/route.ts`
- Create: `app/api/views/[id]/route.ts`
- Create: `tests/integration/views.test.ts`

- [ ] **Step 1: Create `lib/services/views.ts`**

```typescript
// lib/services/views.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { views } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type View = typeof views.$inferSelect;

export type CreateViewInput = {
  name: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
};

export type UpdateViewInput = {
  name?: string;
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
};

export async function listViews(userId: string): Promise<View[]> {
  return db.select().from(views).where(eq(views.userId, userId));
}

export async function getView(userId: string, id: string): Promise<View | null> {
  const [row] = await db.select().from(views).where(and(eq(views.id, id), eq(views.userId, userId)));
  return row ?? null;
}

export async function createView(userId: string, input: CreateViewInput): Promise<View> {
  const [row] = await db
    .insert(views)
    .values({ id: newId(), userId, ...input, updatedAt: new Date() })
    .returning();
  return row;
}

export async function updateView(userId: string, id: string, input: UpdateViewInput): Promise<View | null> {
  const [row] = await db
    .update(views)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(views.id, id), eq(views.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteView(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(views)
    .where(and(eq(views.id, id), eq(views.userId, userId)))
    .returning({ id: views.id });
  return !!deleted;
}
```

- [ ] **Step 2: Create `app/api/views/route.ts`**

```typescript
// app/api/views/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createView, listViews } from '@/lib/services/views';

const CreateViewSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.record(z.unknown()).default({}),
  sort: z.record(z.unknown()).default({}),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listViews(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateViewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const view = await createView(userId, parsed.data);
  return NextResponse.json(view, { status: 201 });
}
```

- [ ] **Step 3: Create `app/api/views/[id]/route.ts`**

```typescript
// app/api/views/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteView, getView, updateView } from '@/lib/services/views';

const UpdateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: z.record(z.unknown()).optional(),
  sort: z.record(z.unknown()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const view = await getView(userId, id);
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(view);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateViewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const view = await updateView(userId, id, parsed.data);
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(view);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteView(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Create `tests/integration/views.test.ts`**

```typescript
// tests/integration/views.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_USER_ID = 'user-test-1';
const MOCK_VIEW = {
  id: 'view-1',
  userId: MOCK_USER_ID,
  name: 'Active tasks',
  filters: { status: 'pending' },
  sort: { field: 'priority', dir: 'asc' },
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
};

function req(url: string, opts?: { method?: string; body?: unknown }) {
  return new NextRequest(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe('GET /api/views', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    }));
    vi.mock('@/lib/services/views', () => ({ listViews: vi.fn(), createView: vi.fn() }));

    const { GET } = await import('@/app/api/views/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns view list', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/views', () => ({ listViews: vi.fn().mockResolvedValue([MOCK_VIEW]), createView: vi.fn() }));

    const { GET } = await import('@/app/api/views/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe('Active tasks');
  });
});

describe('POST /api/views', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates view and returns 201', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/views', () => ({ listViews: vi.fn(), createView: vi.fn().mockResolvedValue(MOCK_VIEW) }));

    const { POST } = await import('@/app/api/views/route');
    const res = await POST(req('http://localhost/api/views', { method: 'POST', body: { name: 'Active tasks' } }));
    expect(res.status).toBe(201);
  });

  it('returns 400 when name is missing', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/views', () => ({ listViews: vi.fn(), createView: vi.fn() }));

    const { POST } = await import('@/app/api/views/route');
    const res = await POST(req('http://localhost/api/views', { method: 'POST', body: {} }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/views/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 404 for missing view', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/views', () => ({ getView: vi.fn().mockResolvedValue(null), updateView: vi.fn(), deleteView: vi.fn() }));

    const { GET } = await import('@/app/api/views/[id]/route');
    const res = await GET(req('http://localhost/api/views/ghost'), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });

  it('returns view by id', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/views', () => ({ getView: vi.fn().mockResolvedValue(MOCK_VIEW), updateView: vi.fn(), deleteView: vi.fn() }));

    const { GET } = await import('@/app/api/views/[id]/route');
    const res = await GET(req('http://localhost/api/views/view-1'), { params: Promise.resolve({ id: 'view-1' }) });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/views/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 204 on success', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/views', () => ({ getView: vi.fn(), updateView: vi.fn(), deleteView: vi.fn().mockResolvedValue(true) }));

    const { DELETE } = await import('@/app/api/views/[id]/route');
    const res = await DELETE(req('http://localhost/api/views/view-1'), { params: Promise.resolve({ id: 'view-1' }) });
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test tests/integration/views.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/services/views.ts app/api/views/ tests/integration/views.test.ts
git commit -m "feat: views CRUD — service, route handlers, integration tests"
```

---

## Task 7: Calendars Service + Route Handlers + Tests

**Files:**
- Create: `lib/services/calendars.ts`
- Create: `app/api/calendars/route.ts`
- Create: `app/api/calendars/[id]/route.ts`
- Create: `tests/integration/calendars.test.ts`

- [ ] **Step 1: Create `lib/services/calendars.ts`**

```typescript
// lib/services/calendars.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';

export type GoogleCalendar = typeof googleCalendars.$inferSelect;

export async function listCalendars(userId: string): Promise<GoogleCalendar[]> {
  return db.select().from(googleCalendars).where(eq(googleCalendars.userId, userId));
}

export async function setCalendarSelected(
  userId: string,
  id: string,
  selected: boolean,
): Promise<GoogleCalendar | null> {
  const [row] = await db
    .update(googleCalendars)
    .set({ selected, updatedAt: new Date() })
    .where(and(eq(googleCalendars.id, id), eq(googleCalendars.userId, userId)))
    .returning();
  return row ?? null;
}
```

- [ ] **Step 2: Create `app/api/calendars/route.ts`**

```typescript
// app/api/calendars/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listCalendars } from '@/lib/services/calendars';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listCalendars(userId));
}
```

- [ ] **Step 3: Create `app/api/calendars/[id]/route.ts`**

```typescript
// app/api/calendars/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { setCalendarSelected } from '@/lib/services/calendars';

const PatchCalendarSchema = z.object({
  selected: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchCalendarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const calendar = await setCalendarSelected(userId, id, parsed.data.selected);
  if (!calendar) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(calendar);
}
```

- [ ] **Step 4: Create `tests/integration/calendars.test.ts`**

```typescript
// tests/integration/calendars.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_USER_ID = 'user-test-1';
const MOCK_CALENDAR = {
  id: 'cal-1',
  userId: MOCK_USER_ID,
  googleAccountId: 'gacct-1',
  calendarId: 'primary',
  name: 'Sam',
  color: '#4285f4',
  selected: false,
  isPrimary: true,
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
};

function req(url: string, opts?: { method?: string; body?: unknown }) {
  return new NextRequest(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe('GET /api/calendars', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    }));
    vi.mock('@/lib/services/calendars', () => ({ listCalendars: vi.fn(), setCalendarSelected: vi.fn() }));

    const { GET } = await import('@/app/api/calendars/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns calendar list', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/calendars', () => ({ listCalendars: vi.fn().mockResolvedValue([MOCK_CALENDAR]), setCalendarSelected: vi.fn() }));

    const { GET } = await import('@/app/api/calendars/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].calendarId).toBe('primary');
  });
});

describe('PATCH /api/calendars/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('selects calendar and returns updated', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/calendars', () => ({
      listCalendars: vi.fn(),
      setCalendarSelected: vi.fn().mockResolvedValue({ ...MOCK_CALENDAR, selected: true }),
    }));

    const { PATCH } = await import('@/app/api/calendars/[id]/route');
    const res = await PATCH(
      req('http://localhost/api/calendars/cal-1', { method: 'PATCH', body: { selected: true } }),
      { params: Promise.resolve({ id: 'cal-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.selected).toBe(true);
  });

  it('returns 400 when selected field is missing', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/calendars', () => ({ listCalendars: vi.fn(), setCalendarSelected: vi.fn() }));

    const { PATCH } = await import('@/app/api/calendars/[id]/route');
    const res = await PATCH(
      req('http://localhost/api/calendars/cal-1', { method: 'PATCH', body: {} }),
      { params: Promise.resolve({ id: 'cal-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when calendar not found', async () => {
    vi.resetModules();
    vi.mock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }) }));
    vi.mock('@/lib/services/calendars', () => ({ listCalendars: vi.fn(), setCalendarSelected: vi.fn().mockResolvedValue(null) }));

    const { PATCH } = await import('@/app/api/calendars/[id]/route');
    const res = await PATCH(
      req('http://localhost/api/calendars/ghost', { method: 'PATCH', body: { selected: true } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test tests/integration/calendars.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/services/calendars.ts app/api/calendars/ tests/integration/calendars.test.ts
git commit -m "feat: calendars list/select — service, route handlers, integration tests"
```

---

## Task 8: Final Checks + CHANGELOG

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (health + tasks + tags + views + calendars).

- [ ] **Step 2: TypeScript clean**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Lint clean**

```bash
pnpm lint
```

Expected: exits 0.

- [ ] **Step 4: Update `CHANGELOG.md`**

Tick these off in the Current State → Built section:
- `[x] Tasks CRUD (route handlers + service + tests)`
- `[x] Tags CRUD`
- `[x] Views CRUD`
- `[x] Calendar list/select endpoint`

Append at the top of the Sessions section:

```markdown
## 2026-04-15 — Session 2: Tasks/Tags/Views/Calendars CRUD

**Goal for this session:** Build full CRUD for tasks (with tags), tags, views, and a calendar list/select endpoint.

**Built:**
- `lib/auth/helpers.ts` — `requireAuth()` helper (returns userId or 401 Response)
- `lib/services/tasks.ts` — listTasks, getTask, createTask, updateTask, deleteTask; tasks returned with `tags[]`
- `app/api/tasks/route.ts` + `app/api/tasks/[id]/route.ts` — full CRUD, Zod validation
- `lib/services/tags.ts` — full CRUD
- `app/api/tags/route.ts` + `app/api/tags/[id]/route.ts`
- `lib/services/views.ts` — full CRUD
- `app/api/views/route.ts` + `app/api/views/[id]/route.ts`
- `lib/services/calendars.ts` — listCalendars, setCalendarSelected
- `app/api/calendars/route.ts` + `app/api/calendars/[id]/route.ts`
- Integration tests for all four feature groups (mocked services + auth helper)

**Decisions made:**
- Services mocked in integration tests (not DB-level mocking) — clean, fast, tests route handler contract
- `requireAuth()` returns `{ userId } | Response` — checked with `instanceof Response` in each handler
- Tasks always returned with `tags[]` array — service handles the join

**Files touched:** 17 files created

**Tests added:** ~30

**Next action:**
- Session 3: Scheduler pure-function pipeline (`lib/scheduler/urgency.ts`, `slots.ts`, `placement.ts`) with unit tests. Read `references/scheduling-engine.md` first.
```

- [ ] **Step 5: Update TODO.md**

Mark as done:
- `[x] Tasks CRUD (route handlers + service + tests)`
- `[x] Tags CRUD`
- `[x] Views CRUD`
- `[x] Calendar list/select endpoint`

- [ ] **Step 6: Final commit**

```bash
git add CHANGELOG.md TODO.md
git commit -m "chore: update CHANGELOG and TODO for session 2"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| `lib/auth/helpers.ts` with `requireAuth()` | Task 1 |
| Tasks service: listTasks, getTask, createTask, updateTask, deleteTask | Task 2 |
| Tasks include `tags[]` array | Task 2 (`attachTags` helper) |
| `app/api/tasks/` route handlers (GET+POST, GET+PATCH+DELETE) | Task 3 |
| Tasks integration tests (401, 200, 201, 400, 404, 204) | Task 4 |
| Tags service + route handlers + tests | Task 5 |
| Views service + route handlers + tests | Task 6 |
| Calendars service + route handlers + tests | Task 7 |
| Commit per feature group | Tasks 4, 5, 6, 7 |
| CHANGELOG + TODO updated | Task 8 |
| No `projectId` anywhere | Verified — tasks schema has no `projectId`, no service uses it |
| Route handlers ≤ 80 lines | All route handlers are 40–60 lines |
| Service files ≤ 200 lines | All services are 50–120 lines |

No gaps.

### Placeholder scan

No TBD, TODO, "similar to Task N", or incomplete steps found.

### Type consistency

- `requireAuth()` return type `{ userId: string } | NextResponse` — used with `instanceof Response` check in all 8 route files.
- `listTasks` / `getTask` return `TaskWithTags` — `tags[]` is present on the returned type.
- `updateTask` returns `TaskWithTags | null` — handler checks for null → 404.
- `deleteTask` returns `boolean` — handler checks false → 404.
- `setCalendarSelected` returns `GoogleCalendar | null` — handler checks null → 404.
- `CreateTaskInput.tagIds` is `string[]` — matches `CreateTaskSchema`'s `tagIds: z.array(z.string()).default([])`.
- `UpdateTaskInput.tagIds` is `string[] | undefined` — matches `UpdateTaskSchema`'s `tagIds: z.array(z.string()).optional()`.

All consistent.
