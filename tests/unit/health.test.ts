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
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection refused'));

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.db).toBe('disconnected');
  });
});
