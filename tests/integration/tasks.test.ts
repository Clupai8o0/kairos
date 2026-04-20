// tests/integration/tasks.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock global fetch to swallow fire-and-forget drain calls
global.fetch = vi.fn().mockResolvedValue({} as Response);

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
  timeLocked: false,
  preferredTemplateId: null,
  tags: [{ id: 'tag-1', name: 'work', color: '#3b82f6' }],
};

function jsonRequest(url: string, opts?: { method?: string; body?: unknown }) {
  return new NextRequest(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : {},
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

// Helper: set up fresh mocks for each test using vi.doMock (not hoisted)
async function setupRouteModule(
  modulePath: string,
  authResult: unknown,
  tasksMock: Record<string, unknown>,
  recurrenceMock?: Record<string, unknown>,
) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({
    requireAuth: vi.fn().mockResolvedValue(authResult),
  }));
  vi.doMock('@/lib/services/tasks', () => tasksMock);
  vi.doMock('@/lib/services/jobs', () => ({ enqueueJob: vi.fn().mockResolvedValue(null) }));
  vi.doMock('@/lib/db/client', () => ({
    db: {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    },
  }));
  vi.doMock('@/lib/db/schema', () => ({ tasks: {}, googleCalendars: {}, googleAccounts: {}, user: {}, account: {} }));
  vi.doMock('drizzle-orm', async (importOriginal) => {
    const orig = await importOriginal<typeof import('drizzle-orm')>();
    return { ...orig, and: vi.fn(), eq: vi.fn() };
  });
  vi.doMock('@/lib/gcal/events', () => ({ deleteEvent: vi.fn().mockResolvedValue(undefined) }));
  vi.doMock('@/lib/gcal/calendars', () => ({ getWriteCalendarId: vi.fn().mockResolvedValue('cal-id') }));
  if (recurrenceMock) {
    vi.doMock('@/lib/services/recurrence', () => recurrenceMock);
  }
  return import(modulePath);
}

describe('GET /api/tasks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await setupRouteModule(
      '@/app/api/tasks/route',
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      { listTasks: vi.fn(), createTask: vi.fn() },
    );
    const res = await GET(jsonRequest('http://localhost/api/tasks'));
    expect(res.status).toBe(401);
  });

  it('returns task list for authenticated user', async () => {
    const { GET } = await setupRouteModule(
      '@/app/api/tasks/route',
      { userId: MOCK_USER_ID },
      { listTasks: vi.fn().mockResolvedValue([MOCK_TASK]), createTask: vi.fn() },
    );
    const res = await GET(jsonRequest('http://localhost/api/tasks'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('task-1');
  });

  it('returns 400 for invalid status query param', async () => {
    const { GET } = await setupRouteModule(
      '@/app/api/tasks/route',
      { userId: MOCK_USER_ID },
      { listTasks: vi.fn(), createTask: vi.fn() },
    );
    const res = await GET(jsonRequest('http://localhost/api/tasks?status=invalid'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await setupRouteModule(
      '@/app/api/tasks/route',
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      { listTasks: vi.fn(), createTask: vi.fn() },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks', { method: 'POST', body: { title: 'Test' } }),
    );
    expect(res.status).toBe(401);
  });

  it('creates a task and returns 201', async () => {
    const { POST } = await setupRouteModule(
      '@/app/api/tasks/route',
      { userId: MOCK_USER_ID },
      { listTasks: vi.fn(), createTask: vi.fn().mockResolvedValue(MOCK_TASK) },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks', {
        method: 'POST',
        body: { title: 'Write tests', priority: 2 },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('task-1');
    expect(body.tags).toHaveLength(1);
  });

  it('returns 400 when title is missing', async () => {
    const { POST } = await setupRouteModule(
      '@/app/api/tasks/route',
      { userId: MOCK_USER_ID },
      { listTasks: vi.fn(), createTask: vi.fn() },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks', { method: 'POST', body: { priority: 2 } }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns task by id', async () => {
    const { GET } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn().mockResolvedValue(MOCK_TASK), updateTask: vi.fn() },
      { deleteInstance: vi.fn(), deleteSeries: vi.fn() },
    );
    const res = await GET(
      jsonRequest('http://localhost/api/tasks/task-1'),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('task-1');
  });

  it('returns 404 for non-existent task', async () => {
    const { GET } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn().mockResolvedValue(null), updateTask: vi.fn() },
      { deleteInstance: vi.fn(), deleteSeries: vi.fn() },
    );
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
    const { PATCH } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      {
        getTask: vi.fn(),
        updateTask: vi.fn().mockResolvedValue({ ...MOCK_TASK, title: 'Updated' }),
      },
      { deleteInstance: vi.fn(), deleteSeries: vi.fn() },
    );
    const res = await PATCH(
      jsonRequest('http://localhost/api/tasks/task-1', { method: 'PATCH', body: { title: 'Updated' } }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated');
  });

  it('returns 404 when task not found', async () => {
    const { PATCH } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn().mockResolvedValue(null) },
      { deleteInstance: vi.fn(), deleteSeries: vi.fn() },
    );
    const res = await PATCH(
      jsonRequest('http://localhost/api/tasks/ghost', { method: 'PATCH', body: { title: 'x' } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status value', async () => {
    const { PATCH } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn() },
      { deleteInstance: vi.fn(), deleteSeries: vi.fn() },
    );
    const res = await PATCH(
      jsonRequest('http://localhost/api/tasks/task-1', {
        method: 'PATCH',
        body: { status: 'flying' },
      }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 204 on success (instance scope)', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn() },
      { deleteInstance: vi.fn().mockResolvedValue({ id: 'task-1', gcalEventId: null }), deleteSeries: vi.fn() },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/task-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(204);
  });

  it('returns 404 when task not found (instance)', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn() },
      { deleteInstance: vi.fn().mockResolvedValue(null), deleteSeries: vi.fn() },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/ghost', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tasks/:id?scope=series', () => {
  beforeEach(() => vi.resetAllMocks());

  it('deletes entire series and returns 204', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn() },
      {
        deleteInstance: vi.fn(),
        deleteSeries: vi.fn().mockResolvedValue({
          deletedIds: ['task-1', 'task-2', 'task-3'],
          gcalEventIds: ['gcal-1', 'gcal-2'],
        }),
      },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/task-1?scope=series', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(204);
  });

  it('returns 404 when series delete finds nothing', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn() },
      {
        deleteInstance: vi.fn(),
        deleteSeries: vi.fn().mockResolvedValue({ deletedIds: [], gcalEventIds: [] }),
      },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/task-1?scope=series', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid scope', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn() },
      { deleteInstance: vi.fn(), deleteSeries: vi.fn() },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/task-1?scope=invalid', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks/:id/complete', () => {
  beforeEach(() => vi.resetAllMocks());

  async function setupCompleteRouteModule(
    authResult: unknown,
    tasksMock: Record<string, unknown>,
    recurrenceMock?: Record<string, unknown>,
  ) {
    vi.resetModules();
    vi.doMock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue(authResult),
    }));
    vi.doMock('@/lib/services/tasks', () => tasksMock);
    vi.doMock('@/lib/services/jobs', () => ({ enqueueJob: vi.fn().mockResolvedValue(null) }));
    vi.doMock('@/lib/db/client', () => ({
      db: { update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }) },
    }));
    vi.doMock('@/lib/db/schema', () => ({
      tasks: { id: 'id', userId: 'user_id' },
    }));
    vi.doMock('drizzle-orm', () => ({
      and: vi.fn((...args: unknown[]) => args),
      eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    }));
    if (recurrenceMock) {
      vi.doMock('@/lib/services/recurrence', () => recurrenceMock);
    }
    return import('@/app/api/tasks/[id]/complete/route');
  }

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await setupCompleteRouteModule(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      { getTask: vi.fn() },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent task', async () => {
    const { POST } = await setupCompleteRouteModule(
      { userId: MOCK_USER_ID },
      { getTask: vi.fn().mockResolvedValue(null) },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/ghost/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });

  it('is idempotent — returns task as-is when already done', async () => {
    const doneTask = { ...MOCK_TASK, status: 'done', completedAt: '2026-04-15T12:00:00Z' };
    const { POST } = await setupCompleteRouteModule(
      { userId: MOCK_USER_ID },
      { getTask: vi.fn().mockResolvedValue(doneTask) },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('done');
  });

  it('completes a non-recurring task (no spawn)', async () => {
    const getTaskMock = vi.fn()
      .mockResolvedValueOnce(MOCK_TASK) // first call: check task
      .mockResolvedValueOnce({ ...MOCK_TASK, status: 'done' }); // second call: return updated
    const { POST } = await setupCompleteRouteModule(
      { userId: MOCK_USER_ID },
      { getTask: getTaskMock },
      { spawnNextOccurrence: vi.fn() },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
  });

  it('completes a recurring task and spawns next', async () => {
    const recurringTask = { ...MOCK_TASK, recurrenceRule: { freq: 'daily', interval: 1, mode: 'after-complete' } };
    const getTaskMock = vi.fn()
      .mockResolvedValueOnce(recurringTask)
      .mockResolvedValueOnce({ ...recurringTask, status: 'done' });
    const spawnMock = vi.fn().mockResolvedValue('new-task-id');
    const { POST } = await setupCompleteRouteModule(
      { userId: MOCK_USER_ID },
      { getTask: getTaskMock },
      { spawnNextOccurrence: spawnMock },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    expect(spawnMock).toHaveBeenCalled();
  });

  it('completing a recurring task past until does NOT spawn', async () => {
    const recurringTask = { ...MOCK_TASK, recurrenceRule: { freq: 'daily', interval: 1, until: '2026-01-01' } };
    const getTaskMock = vi.fn()
      .mockResolvedValueOnce(recurringTask)
      .mockResolvedValueOnce({ ...recurringTask, status: 'done' });
    const spawnMock = vi.fn().mockResolvedValue(null);
    const { POST } = await setupCompleteRouteModule(
      { userId: MOCK_USER_ID },
      { getTask: getTaskMock },
      { spawnNextOccurrence: spawnMock },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    // spawnNextOccurrence was called but returned null (past until)
    expect(spawnMock).toHaveBeenCalled();
  });

  it('completing a recurring task past its count does NOT spawn', async () => {
    const recurringTask = { ...MOCK_TASK, recurrenceRule: { freq: 'daily', interval: 1, count: 3 } };
    const getTaskMock = vi.fn()
      .mockResolvedValueOnce(recurringTask)
      .mockResolvedValueOnce({ ...recurringTask, status: 'done' });
    // spawnNextOccurrence returns null because count is reached
    const spawnMock = vi.fn().mockResolvedValue(null);
    const { POST } = await setupCompleteRouteModule(
      { userId: MOCK_USER_ID },
      { getTask: getTaskMock },
      { spawnNextOccurrence: spawnMock },
    );
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    expect(spawnMock).toHaveBeenCalled();
  });

  it('completion of recurring task enqueues schedule:single-task for spawned instance', async () => {
    const recurringTask = { ...MOCK_TASK, recurrenceRule: { freq: 'daily', interval: 1, mode: 'after-complete' } };
    vi.resetModules();
    const enqueueJobMock = vi.fn().mockResolvedValue(null);
    vi.doMock('@/lib/auth/helpers', () => ({
      requireAuth: vi.fn().mockResolvedValue({ userId: MOCK_USER_ID }),
    }));
    vi.doMock('@/lib/services/tasks', () => ({
      getTask: vi.fn()
        .mockResolvedValueOnce(recurringTask)
        .mockResolvedValueOnce({ ...recurringTask, status: 'done' }),
    }));
    vi.doMock('@/lib/services/jobs', () => ({ enqueueJob: enqueueJobMock }));
    vi.doMock('@/lib/services/recurrence', () => ({
      spawnNextOccurrence: vi.fn().mockResolvedValue('spawned-task-id'),
    }));
    vi.doMock('@/lib/db/client', () => ({
      db: { update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }) },
    }));
    vi.doMock('@/lib/db/schema', () => ({ tasks: {} }));
    vi.doMock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));
    const { POST } = await import('@/app/api/tasks/[id]/complete/route');
    const res = await POST(
      jsonRequest('http://localhost/api/tasks/task-1/complete', { method: 'POST' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(200);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      'schedule:single-task',
      expect.objectContaining({ userId: MOCK_USER_ID, payload: { taskId: 'spawned-task-id' } }),
    );
  });
});
