// tests/integration/me-theme.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u1' }),
}));

// Use a lazy factory so vi.fn() calls happen at mock-creation time (avoids hoisting issue).
vi.mock('@/lib/db/client', () => {
  const mockWhere = vi.fn().mockResolvedValue([]);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  // select chain: db.select().from().where() — used for themeInstalls lookup on unknown packs
  const mockSelectWhere = vi.fn().mockResolvedValue([]);
  const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { db: { update: mockUpdate, select: mockSelect } };
});

import { PATCH } from '@/app/api/me/theme/route';
import { NextRequest } from 'next/server';

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/me/theme', () => {
  it('accepts a valid built-in themeId and returns it', async () => {
    const req = new NextRequest('http://localhost/api/me/theme', {
      method: 'PATCH',
      body: JSON.stringify({ themeId: 'morning-light' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect((await res.json()).themeId).toBe('morning-light');
  });

  it('accepts the default obsidian-linear pack', async () => {
    const req = new NextRequest('http://localhost/api/me/theme', {
      method: 'PATCH',
      body: JSON.stringify({ themeId: 'obsidian-linear' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect((await res.json()).themeId).toBe('obsidian-linear');
  });

  it('returns 400 for an unknown pack id', async () => {
    const req = new NextRequest('http://localhost/api/me/theme', {
      method: 'PATCH',
      body: JSON.stringify({ themeId: 'unknown-pack' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing themeId', async () => {
    const req = new NextRequest('http://localhost/api/me/theme', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
