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

async function setupCollectionRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/views', () => serviceMock);
  return import('@/app/api/views/route');
}

async function setupItemRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/views', () => serviceMock);
  return import('@/app/api/views/[id]/route');
}

const UNAUTH = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

describe('GET /api/views', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await setupCollectionRoute(UNAUTH, { listViews: vi.fn(), createView: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns view list', async () => {
    const { GET } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listViews: vi.fn().mockResolvedValue([MOCK_VIEW]), createView: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe('Active tasks');
  });
});

describe('POST /api/views', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates view and returns 201', async () => {
    const { POST } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listViews: vi.fn(), createView: vi.fn().mockResolvedValue(MOCK_VIEW) });
    const res = await POST(req('http://localhost/api/views', { method: 'POST', body: { name: 'Active tasks' } }));
    expect(res.status).toBe(201);
  });

  it('returns 400 when name is missing', async () => {
    const { POST } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listViews: vi.fn(), createView: vi.fn() });
    const res = await POST(req('http://localhost/api/views', { method: 'POST', body: {} }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/views/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 404 for missing view', async () => {
    const { GET } = await setupItemRoute({ userId: MOCK_USER_ID }, { getView: vi.fn().mockResolvedValue(null), updateView: vi.fn(), deleteView: vi.fn() });
    const res = await GET(req('http://localhost/api/views/ghost'), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });

  it('returns view by id', async () => {
    const { GET } = await setupItemRoute({ userId: MOCK_USER_ID }, { getView: vi.fn().mockResolvedValue(MOCK_VIEW), updateView: vi.fn(), deleteView: vi.fn() });
    const res = await GET(req('http://localhost/api/views/view-1'), { params: Promise.resolve({ id: 'view-1' }) });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/views/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 204 on success', async () => {
    const { DELETE } = await setupItemRoute({ userId: MOCK_USER_ID }, { getView: vi.fn(), updateView: vi.fn(), deleteView: vi.fn().mockResolvedValue(true) });
    const res = await DELETE(req('http://localhost/api/views/view-1'), { params: Promise.resolve({ id: 'view-1' }) });
    expect(res.status).toBe(204);
  });
});
