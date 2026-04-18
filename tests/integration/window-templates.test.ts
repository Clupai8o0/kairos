// tests/integration/window-templates.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_USER_ID = 'user-test-1';
const MOCK_TEMPLATE = {
  id: 'tpl-1',
  userId: MOCK_USER_ID,
  name: 'Work',
  description: null,
  color: '#3b82f6',
  isDefault: true,
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
  vi.doMock('@/lib/services/window-templates', () => serviceMock);
  return import('@/app/api/window-templates/route');
}

async function setupItemRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/window-templates', () => serviceMock);
  return import('@/app/api/window-templates/[id]/route');
}

const UNAUTH = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

describe('GET /api/window-templates', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await setupCollectionRoute(UNAUTH, { listWindowTemplates: vi.fn(), createWindowTemplate: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns template list', async () => {
    const { GET } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listWindowTemplates: vi.fn().mockResolvedValue([MOCK_TEMPLATE]), createWindowTemplate: vi.fn() },
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Work');
  });
});

describe('POST /api/window-templates', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates template and returns 201', async () => {
    const { POST } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listWindowTemplates: vi.fn(), createWindowTemplate: vi.fn().mockResolvedValue(MOCK_TEMPLATE) },
    );
    const res = await POST(req('http://localhost/api/window-templates', {
      method: 'POST',
      body: { name: 'Work', color: '#3b82f6', isDefault: true },
    }));
    expect(res.status).toBe(201);
  });

  it('returns 400 when name is missing', async () => {
    const { POST } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listWindowTemplates: vi.fn(), createWindowTemplate: vi.fn() },
    );
    const res = await POST(req('http://localhost/api/window-templates', {
      method: 'POST',
      body: {},
    }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/window-templates/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns template by id', async () => {
    const { GET } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getWindowTemplate: vi.fn().mockResolvedValue(MOCK_TEMPLATE), updateWindowTemplate: vi.fn(), deleteWindowTemplate: vi.fn() },
    );
    const res = await GET(req('http://localhost/api/window-templates/tpl-1'), { params: Promise.resolve({ id: 'tpl-1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing template', async () => {
    const { GET } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getWindowTemplate: vi.fn().mockResolvedValue(null), updateWindowTemplate: vi.fn(), deleteWindowTemplate: vi.fn() },
    );
    const res = await GET(req('http://localhost/api/window-templates/ghost'), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/window-templates/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates template and returns 200', async () => {
    const { PATCH } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getWindowTemplate: vi.fn(), updateWindowTemplate: vi.fn().mockResolvedValue({ ...MOCK_TEMPLATE, name: 'Personal' }), deleteWindowTemplate: vi.fn() },
    );
    const res = await PATCH(
      req('http://localhost/api/window-templates/tpl-1', { method: 'PATCH', body: { name: 'Personal' } }),
      { params: Promise.resolve({ id: 'tpl-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Personal');
  });

  it('returns 404 when template not found', async () => {
    const { PATCH } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getWindowTemplate: vi.fn(), updateWindowTemplate: vi.fn().mockResolvedValue(null), deleteWindowTemplate: vi.fn() },
    );
    const res = await PATCH(
      req('http://localhost/api/window-templates/ghost', { method: 'PATCH', body: { name: 'X' } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/window-templates/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('deletes template and returns 204', async () => {
    const { DELETE } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getWindowTemplate: vi.fn(), updateWindowTemplate: vi.fn(), deleteWindowTemplate: vi.fn().mockResolvedValue(true) },
    );
    const res = await DELETE(req('http://localhost/api/window-templates/tpl-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'tpl-1' }) });
    expect(res.status).toBe(204);
  });

  it('returns 404 when template not found (or is default)', async () => {
    const { DELETE } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getWindowTemplate: vi.fn(), updateWindowTemplate: vi.fn(), deleteWindowTemplate: vi.fn().mockResolvedValue(false) },
    );
    const res = await DELETE(req('http://localhost/api/window-templates/ghost', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});
