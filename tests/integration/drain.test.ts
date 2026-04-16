import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/jobs', () => ({
  claimPendingJobs: vi.fn().mockResolvedValue([]),
  markJobDone: vi.fn(),
  markJobFailed: vi.fn(),
}));
vi.mock('@/lib/scheduler/runner', () => ({ scheduleSingleTask: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/gcal/adapter', () => ({ createGCalAdapter: vi.fn() }));
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  },
}));

import { GET } from '@/app/api/cron/drain/route';

describe('GET /api/cron/drain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with drain summary when no jobs pending', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ drained: 0, succeeded: 0, failed: 0 });
  });

  it('processes a schedule:single-task job', async () => {
    const { claimPendingJobs } = await import('@/lib/services/jobs');
    const { scheduleSingleTask } = await import('@/lib/scheduler/runner');
    (claimPendingJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'j1', type: 'schedule:single-task', payload: { taskId: 't1' }, userId: 'u1', maxAttempts: 3, attempts: 1 },
    ]);

    await GET();
    expect(scheduleSingleTask).toHaveBeenCalledWith('u1', 't1', undefined);
  });
});
