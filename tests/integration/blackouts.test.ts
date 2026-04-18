// tests/integration/blackouts.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_USER_ID = 'user-test-1';
const MOCK_BLACKOUT = {
  id: 'bo-1',
  userId: MOCK_USER_ID,
  startAt: new Date('2026-04-20T09:00:00Z'),
  endAt: new Date('2026-04-20T17:00:00Z'),
  recurrenceRule: null,
  reason: 'Vacation',
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
  vi.doMock('@/lib/services/blackouts', () => serviceMock);
  return import('@/app/api/blackouts/route');
}

async function setupItemRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/blackouts', () => serviceMock);
  return import('@/app/api/blackouts/[id]/route');
}

const UNAUTH = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

describe('GET /api/blackouts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await setupCollectionRoute(UNAUTH, { listBlackouts: vi.fn(), createBlackout: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns blackout list', async () => {
    const { GET } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listBlackouts: vi.fn().mockResolvedValue([MOCK_BLACKOUT]), createBlackout: vi.fn() },
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe('POST /api/blackouts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates blackout and returns 201', async () => {
    const { POST } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listBlackouts: vi.fn(), createBlackout: vi.fn().mockResolvedValue(MOCK_BLACKOUT) },
    );
    const res = await POST(req('http://localhost/api/blackouts', {
      method: 'POST',
      body: { startAt: '2026-04-20T09:00:00Z', endAt: '2026-04-20T17:00:00Z', reason: 'Vacation' },
    }));
    expect(res.status).toBe(201);
  });

  it('returns 400 when startAt is missing', async () => {
    const { POST } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listBlackouts: vi.fn(), createBlackout: vi.fn() },
    );
    const res = await POST(req('http://localhost/api/blackouts', {
      method: 'POST',
      body: { endAt: '2026-04-20T17:00:00Z' },
    }));
    expect(res.status).toBe(400);
  });

  it('accepts recurrenceRule', async () => {
    const { POST } = await setupCollectionRoute(
      { userId: MOCK_USER_ID },
      { listBlackouts: vi.fn(), createBlackout: vi.fn().mockResolvedValue(MOCK_BLACKOUT) },
    );
    const res = await POST(req('http://localhost/api/blackouts', {
      method: 'POST',
      body: {
        startAt: '2026-04-20T09:00:00Z',
        endAt: '2026-04-20T17:00:00Z',
        recurrenceRule: { freq: 'weekly', byDayOfWeek: [1] },
      },
    }));
    expect(res.status).toBe(201);
  });
});

describe('GET /api/blackouts/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns blackout by id', async () => {
    const { GET } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getBlackout: vi.fn().mockResolvedValue(MOCK_BLACKOUT), updateBlackout: vi.fn(), deleteBlackout: vi.fn() },
    );
    const res = await GET(req('http://localhost/api/blackouts/bo-1'), { params: Promise.resolve({ id: 'bo-1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing blackout', async () => {
    const { GET } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getBlackout: vi.fn().mockResolvedValue(null), updateBlackout: vi.fn(), deleteBlackout: vi.fn() },
    );
    const res = await GET(req('http://localhost/api/blackouts/ghost'), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/blackouts/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates blackout and returns 200', async () => {
    const { PATCH } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getBlackout: vi.fn(), updateBlackout: vi.fn().mockResolvedValue({ ...MOCK_BLACKOUT, reason: 'Doctor' }), deleteBlackout: vi.fn() },
    );
    const res = await PATCH(
      req('http://localhost/api/blackouts/bo-1', { method: 'PATCH', body: { reason: 'Doctor' } }),
      { params: Promise.resolve({ id: 'bo-1' }) },
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 when blackout not found', async () => {
    const { PATCH } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getBlackout: vi.fn(), updateBlackout: vi.fn().mockResolvedValue(null), deleteBlackout: vi.fn() },
    );
    const res = await PATCH(
      req('http://localhost/api/blackouts/ghost', { method: 'PATCH', body: { reason: 'X' } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/blackouts/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('deletes blackout and returns 204', async () => {
    const { DELETE } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getBlackout: vi.fn(), updateBlackout: vi.fn(), deleteBlackout: vi.fn().mockResolvedValue(true) },
    );
    const res = await DELETE(req('http://localhost/api/blackouts/bo-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'bo-1' }) });
    expect(res.status).toBe(204);
  });

  it('returns 404 when blackout not found', async () => {
    const { DELETE } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { getBlackout: vi.fn(), updateBlackout: vi.fn(), deleteBlackout: vi.fn().mockResolvedValue(false) },
    );
    const res = await DELETE(req('http://localhost/api/blackouts/ghost', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ghost' }) });
    expect(res.status).toBe(404);
  });
});
