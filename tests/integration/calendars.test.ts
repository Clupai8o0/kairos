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

async function setupCollectionRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/calendars', () => serviceMock);
  return import('@/app/api/calendars/route');
}

async function setupItemRoute(authMock: unknown, serviceMock: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('@/lib/auth/helpers', () => ({ requireAuth: vi.fn().mockResolvedValue(authMock) }));
  vi.doMock('@/lib/services/calendars', () => serviceMock);
  return import('@/app/api/calendars/[id]/route');
}

const UNAUTH = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

describe('GET /api/calendars', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await setupCollectionRoute(UNAUTH, { listCalendars: vi.fn(), setCalendarSelected: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns calendar list', async () => {
    const { GET } = await setupCollectionRoute({ userId: MOCK_USER_ID }, { listCalendars: vi.fn().mockResolvedValue([MOCK_CALENDAR]), setCalendarSelected: vi.fn() });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].calendarId).toBe('primary');
  });
});

describe('PATCH /api/calendars/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('selects calendar and returns updated', async () => {
    const { PATCH } = await setupItemRoute(
      { userId: MOCK_USER_ID },
      { listCalendars: vi.fn(), setCalendarSelected: vi.fn().mockResolvedValue({ ...MOCK_CALENDAR, selected: true }) },
    );
    const res = await PATCH(
      req('http://localhost/api/calendars/cal-1', { method: 'PATCH', body: { selected: true } }),
      { params: Promise.resolve({ id: 'cal-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.selected).toBe(true);
  });

  it('returns 400 when selected field is missing', async () => {
    const { PATCH } = await setupItemRoute({ userId: MOCK_USER_ID }, { listCalendars: vi.fn(), setCalendarSelected: vi.fn() });
    const res = await PATCH(
      req('http://localhost/api/calendars/cal-1', { method: 'PATCH', body: {} }),
      { params: Promise.resolve({ id: 'cal-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when calendar not found', async () => {
    const { PATCH } = await setupItemRoute({ userId: MOCK_USER_ID }, { listCalendars: vi.fn(), setCalendarSelected: vi.fn().mockResolvedValue(null) });
    const res = await PATCH(
      req('http://localhost/api/calendars/ghost', { method: 'PATCH', body: { selected: true } }),
      { params: Promise.resolve({ id: 'ghost' }) },
    );
    expect(res.status).toBe(404);
  });
});
