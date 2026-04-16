import { describe, it, expect, vi } from 'vitest';

const { mockInsert, mockSelect, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: { insert: mockInsert, select: mockSelect, update: mockUpdate, delete: mockDelete },
}));
vi.mock('@/lib/utils/id', () => ({ newId: vi.fn(() => 'sp1') }));
vi.mock('@/lib/plugins/host', () => ({ dispatchToPlugin: vi.fn() }));

import { createScratchpad } from '@/lib/services/scratchpad';

describe('createScratchpad', () => {
  it('returns a new scratchpad entry', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'sp1', userId: 'u1', content: 'hello', inputType: 'text',
          processed: false, parseResult: null, extractedTaskIds: [],
          inputPayload: {}, createdAt: new Date(), updatedAt: new Date(),
        }]),
      }),
    });

    const result = await createScratchpad('u1', { content: 'hello', inputType: 'text' });
    expect(result.id).toBe('sp1');
    expect(result.content).toBe('hello');
  });
});
