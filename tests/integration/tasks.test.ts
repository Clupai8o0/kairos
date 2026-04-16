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
) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({
    requireAuth: vi.fn().mockResolvedValue(authResult),
  }));
  vi.doMock('@/lib/services/tasks', () => tasksMock);
  vi.doMock('@/lib/services/jobs', () => ({ enqueueJob: vi.fn().mockResolvedValue(null) }));
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
      { getTask: vi.fn().mockResolvedValue(MOCK_TASK), updateTask: vi.fn(), deleteTask: vi.fn() },
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
      { getTask: vi.fn().mockResolvedValue(null), updateTask: vi.fn(), deleteTask: vi.fn() },
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
        deleteTask: vi.fn(),
      },
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
      { getTask: vi.fn(), updateTask: vi.fn().mockResolvedValue(null), deleteTask: vi.fn() },
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
      { getTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn() },
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

  it('returns 204 on success', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn().mockResolvedValue({ id: 'task-1', gcalEventId: null }) },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/task-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'task-1' }) },
    );
    expect(res.status).toBe(204);
  });

  it('returns 404 when task not found', async () => {
    const { DELETE } = await setupRouteModule(
      '@/app/api/tasks/[id]/route',
      { userId: MOCK_USER_ID },
      { getTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn().mockResolvedValue(null) },
    );
    const res = await DELETE(
      jsonRequest('http://localhost/api/tasks/ghost', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});
