import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u1' }),
}));
vi.mock('@/lib/services/scratchpad', () => ({
  createScratchpad: vi.fn().mockResolvedValue({ id: 'sp1', content: 'hello', inputType: 'text', processed: false, userId: 'u1' }),
  listScratchpads: vi.fn().mockResolvedValue([]),
  getScratchpad: vi.fn().mockResolvedValue({ id: 'sp1', content: 'hello', inputType: 'text', processed: true, parseResult: { tasks: [{ title: 'Do thing', priority: 3, tags: [] }] }, userId: 'u1' }),
  processScratchpad: vi.fn().mockResolvedValue({ id: 'sp1', processed: true }),
  commitScratchpad: vi.fn().mockResolvedValue({ taskIds: ['t1', 't2'] }),
  deleteScratchpad: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/services/jobs', () => ({ enqueueJob: vi.fn().mockResolvedValue(null) }));
global.fetch = vi.fn().mockResolvedValue({} as Response);

import { GET, POST } from '@/app/api/scratchpad/route';
import { POST as processPost } from '@/app/api/scratchpad/[id]/process/route';
import { POST as commitPost } from '@/app/api/scratchpad/[id]/commit/route';
import { NextRequest } from 'next/server';

describe('GET /api/scratchpad', () => {
  it('returns empty array', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /api/scratchpad', () => {
  it('creates a scratchpad entry', async () => {
    const req = new NextRequest('http://localhost/api/scratchpad', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello', inputType: 'text' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('sp1');
  });
});

describe('POST /api/scratchpad/:id/process', () => {
  it('returns processed scratchpad', async () => {
    const req = new NextRequest('http://localhost/api/scratchpad/sp1/process', { method: 'POST' });
    const res = await processPost(req, { params: Promise.resolve({ id: 'sp1' }) });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/scratchpad/:id/commit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns created task IDs', async () => {
    global.fetch = vi.fn().mockResolvedValue({} as Response);
    const req = new NextRequest('http://localhost/api/scratchpad/sp1/commit', { method: 'POST' });
    const res = await commitPost(req, { params: Promise.resolve({ id: 'sp1' }) });
    const body = await res.json();
    expect(body.taskIds).toEqual(['t1', 't2']);
  });

  it('self-triggers drain after commit', async () => {
    global.fetch = vi.fn().mockResolvedValue({} as Response);
    const req = new NextRequest('http://localhost/api/scratchpad/sp1/commit', { method: 'POST' });
    await commitPost(req, { params: Promise.resolve({ id: 'sp1' }) });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/cron/drain'),
      expect.any(Object),
    );
  });
});
