import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockUpdate, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
}));
vi.mock('@/lib/utils/id', () => ({ newId: vi.fn(() => 'job-id-1') }));

import { enqueueJob, markJobDone } from '@/lib/services/jobs';

describe('enqueueJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a job with the given type and payload', async () => {
    const chainMock = {
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'job-id-1' }]),
        }),
      }),
    };
    mockInsert.mockReturnValue(chainMock);

    const job = await enqueueJob('schedule:single-task', { userId: 'u1', payload: { taskId: 't1' } });
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(job?.id).toBe('job-id-1');
  });
});

describe('markJobDone', () => {
  it('sets status to done', async () => {
    const chainMock = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
    mockUpdate.mockReturnValue(chainMock);

    await markJobDone('job-id-1');
    expect(chainMock.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
  });
});
