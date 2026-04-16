import { describe, it, expect, vi } from 'vitest';
import { TextToTasksPlugin } from '@/lib/plugins/builtin/text-to-tasks';
import type { ScratchpadInput, PluginContext } from '@/lib/plugins/types';

const plugin = new TextToTasksPlugin();

const input: ScratchpadInput = {
  id: 's1', userId: 'u1', inputType: 'text',
  content: 'Reply to John about the proposal',
  payload: {}, createdAt: new Date(),
};

const mockContext = {
  userId: 'u1', pluginName: 'text-to-tasks',
  completeStructured: vi.fn().mockResolvedValue({
    tasks: [{ title: 'Reply to John about the proposal', priority: 3, tags: ['email'], durationMins: 10 }],
  }),
  getRulesets: vi.fn().mockResolvedValue([]),
  log: vi.fn(),
} as unknown as PluginContext;

describe('TextToTasksPlugin', () => {
  it('canHandle returns true for text input', () => {
    expect(plugin.canHandle(input)).toBe(true);
  });

  it('canHandle returns false for url input', () => {
    expect(plugin.canHandle({ ...input, inputType: 'url' })).toBe(false);
  });

  it('parse returns a ParseResult with tasks', async () => {
    const result = await plugin.parse(input, mockContext);
    expect(result.pluginName).toBe('text-to-tasks');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Reply to John about the proposal');
  });

  it('parse applies rulesets', async () => {
    const ctxWithRuleset = {
      ...mockContext,
      completeStructured: vi.fn().mockResolvedValue({
        tasks: [{ title: 'Send email to Sarah', priority: 3, tags: [], durationMins: null }],
      }),
      getRulesets: vi.fn().mockResolvedValue([
        { if: { contains: 'email' }, then: { tag: 'email', durationMins: 10 } },
      ]),
    } as unknown as PluginContext;

    const result = await plugin.parse(input, ctxWithRuleset);
    expect(result.tasks[0].tags).toContain('email');
    expect(result.tasks[0].durationMins).toBe(10);
  });
});
