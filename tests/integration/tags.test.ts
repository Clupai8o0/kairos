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

async function setupCollectionRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/tags', () => serviceMock);
  return import('@/app/api/tags/route');
}

async function setupItemRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/tags', () => serviceMock);
  return import('@/app/api/tags/[id]/route');
}

const UNAUTH = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

describe('GET /api/tags', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await setupCollectionRoute(UNAUTH, { listTags: vi.fn(), createTag: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns tag list', async () => {
    const { GET } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listTags: vi.fn().mockResolvedValue([MOCK_TAG]), createTag: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe('work');
  });
});

describe('POST /api/tags', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates tag and returns 201', async () => {
    const { POST } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listTags: vi.fn(), createTag: vi.fn().mockResolvedValue(MOCK_TAG) });
    const res = await POST(req('http://localhost/api/tags', { method: 'POST', body: { name: 'work', color: '#3b82f6' } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('work');
  });

  it('returns 400 when name is missing', async () => {
    const { POST } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listTags: vi.fn(), createTag: vi.fn() });
    const res = await POST(req('http://localhost/api/tags', { method: 'POST', body: {} }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tags/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns tag by id', async () => {
    const { GET } = await setupItemRoute({ userId: MOCK_USER_ID }, { getTag: vi.fn().mockResolvedValue(MOCK_TAG), updateTag: vi.fn(), deleteTag: vi.fn() });
    const res = await GET(req('http://localhost/api/tags/tag-1'), { params: Promise.resolve({ id: 'tag-1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing tag', async () => {
    const { GET } = await setupItemRoute({ userId: MOCK_USER_ID }, { getTag: vi.fn().mockResolvedValue(null), updateTag: vi.fn(), deleteTag: vi.fn() });
    const res = await GET(req('http://localhost/api/tags/ghost'), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tags/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates tag and returns 200', async () => {
    const { PATCH } = await setupItemRoute({ userId: MOCK_USER_ID }, { getTag: vi.fn(), updateTag: vi.fn().mockResolvedValue({ ...MOCK_TAG, name: 'personal' }), deleteTag: vi.fn() });
    const res = await PATCH(
      req('http://localhost/api/tags/tag-1', { method: 'PATCH', body: { name: 'personal' } }),
      { params: Promise.resolve({ id: 'tag-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('personal');
  });

  it('returns 404 when tag not found', async () => {
    const { PATCH } = await setupItemRoute({ userId: MOCK_USER_ID }, { getTag: vi.fn(), updateTag: vi.fn().mockResolvedValue(null), deleteTag: vi.fn() });
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
    const { DELETE } = await setupItemRoute({ userId: MOCK_USER_ID }, { getTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn().mockResolvedValue(true) });
    const res = await DELETE(req('http://localhost/api/tags/tag-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'tag-1' }) });
    expect(res.status).toBe(204);
  });

  it('returns 404 when tag not found', async () => {
    const { DELETE } = await setupItemRoute({ userId: MOCK_USER_ID }, { getTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn().mockResolvedValue(false) });
    const res = await DELETE(req('http://localhost/api/tags/ghost', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});
