import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth/helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u1' }),
}));
vi.mock('@/lib/plugins/host', () => ({
  listPlugins: vi.fn().mockReturnValue([{
    name: 'text-to-tasks', version: '1.0.0', displayName: 'Text to Tasks', description: '', author: 'Kairos',
  }]),
  getPluginWithConfig: vi.fn().mockResolvedValue({
    name: 'text-to-tasks', version: '1.0.0', displayName: 'Text to Tasks', enabled: true, config: {}, rulesets: [],
  }),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
}));

import { GET } from '@/app/api/plugins/route';
import { GET as getOne, PATCH } from '@/app/api/plugins/[name]/route';
import { NextRequest } from 'next/server';

describe('GET /api/plugins', () => {
  it('returns plugin list with config', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('text-to-tasks');
  });
});

describe('GET /api/plugins/:name', () => {
  it('returns plugin detail', async () => {
    const req = new NextRequest('http://localhost/api/plugins/text-to-tasks');
    const res = await getOne(req, { params: Promise.resolve({ name: 'text-to-tasks' }) });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/plugins/:name', () => {
  it('updates enabled flag', async () => {
    const req = new NextRequest('http://localhost/api/plugins/text-to-tasks', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ name: 'text-to-tasks' }) });
    expect(res.status).toBe(200);
  });
});
