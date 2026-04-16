import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));
vi.mock('@/lib/llm', () => ({
  complete: vi.fn().mockResolvedValue('llm response'),
  completeStructured: vi.fn().mockResolvedValue({ tasks: [] }),
}));

import { createPluginContext } from '@/lib/plugins/context';

const existingConfig = {
  id: 'cfg1', userId: 'u1', pluginName: 'test-plugin',
  config: { key: 'val' }, memory: { mem: 1 }, rulesets: [{ if: {}, then: {} }],
  enabled: true, createdAt: new Date(), updatedAt: new Date(),
};

function mockDb(returnVal: unknown) {
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([returnVal]),
    }),
  });
}

describe('PluginContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getConfig returns config from DB', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const config = await ctx.getConfig<{ key: string }>();
    expect(config).toEqual({ key: 'val' });
  });

  it('getMemory returns memory from DB', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const memory = await ctx.getMemory<{ mem: number }>();
    expect(memory).toEqual({ mem: 1 });
  });

  it('getRulesets returns rulesets from DB', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const rulesets = await ctx.getRulesets();
    expect(rulesets).toHaveLength(1);
  });

  it('complete delegates to lib/llm', async () => {
    mockDb(existingConfig);
    const ctx = createPluginContext('u1', 'test-plugin');
    const result = await ctx.complete('hello');
    expect(result).toBe('llm response');
  });
});
