import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/lib/plugins/context', () => ({
  createPluginContext: vi.fn().mockReturnValue({
    userId: 'u1', pluginName: 'text-to-tasks',
    complete: vi.fn(), completeStructured: vi.fn(), getRulesets: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn(), setConfig: vi.fn(), getMemory: vi.fn(), setMemory: vi.fn(),
    updateMemory: vi.fn(), log: vi.fn(),
  }),
}));

import { dispatchToPlugin, listPlugins } from '@/lib/plugins/host';
import type { ScratchpadInput } from '@/lib/plugins/types';

const textInput: ScratchpadInput = {
  id: 's1', userId: 'u1', inputType: 'text', content: 'do something', payload: {}, createdAt: new Date(),
};

describe('listPlugins', () => {
  it('returns the bundled text-to-tasks plugin', () => {
    const plugins = listPlugins();
    expect(plugins.some((p) => p.name === 'text-to-tasks')).toBe(true);
  });
});

describe('dispatchToPlugin', () => {
  it('routes text input to text-to-tasks plugin', async () => {
    const { createPluginContext } = await import('@/lib/plugins/context');
    const ctx = (createPluginContext as ReturnType<typeof vi.fn>)();
    ctx.completeStructured = vi.fn().mockResolvedValue({ tasks: [{ title: 'do something', priority: 3, tags: [] }] });

    await expect(dispatchToPlugin(textInput, 'u1')).resolves.toMatchObject({ pluginName: 'text-to-tasks' });
  });

  it('throws when no plugin can handle the input type', async () => {
    const voiceInput: ScratchpadInput = { ...textInput, inputType: 'voice' };
    await expect(dispatchToPlugin(voiceInput, 'u1')).rejects.toThrow('No plugin can handle');
  });
});
