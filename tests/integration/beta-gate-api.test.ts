// tests/integration/beta-gate-api.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_IP = '127.0.0.1';

// Mock DB so tests don't need a real database
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  betaGateAttempts: { ip: 'ip', attemptedAt: 'attempted_at' },
}));

// Mock drizzle helpers so no real SQL runs
vi.mock('drizzle-orm', async (importOriginal) => {
  const orig = await importOriginal<typeof import('drizzle-orm')>();
  return { ...orig, count: vi.fn(() => 'count'), and: vi.fn(), gte: vi.fn(), eq: vi.fn() };
});

function jsonRequest(body: unknown, ip = MOCK_IP) {
  return new NextRequest('http://localhost:3000/api/beta-gate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/beta-gate', () => {
  beforeEach(() => {
    process.env.BETA_PASSWORD = 'correct-password';
    process.env.BETA_SECRET = 'test-secret-at-least-32-chars-long!!';
    vi.clearAllMocks();
  });

  it('returns 200 and sets cookie on correct password', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('kairos_beta=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('returns 401 on wrong password', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'wrong-password' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid password');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('returns 400 on malformed body', async () => {
    const { POST } = await import('@/app/api/beta-gate/route');
    const req = new NextRequest('http://localhost:3000/api/beta-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 10 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password' }));
    expect(res.status).toBe(429);
  });

  it('sanitises a dangerous next param — absolute URL falls back to /login', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password', next: 'http://evil.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBe('/login');
  });

  it('sanitises a protocol-relative next param — falls back to /login', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password', next: '//evil.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBe('/login');
  });

  it('allows a valid relative next param through', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password', next: '/app/dashboard' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBe('/app/dashboard');
  });
});
