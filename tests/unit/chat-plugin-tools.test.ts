// tests/unit/chat-plugin-tools.test.ts — Unit tests for plugin tool aggregation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScratchpadPlugin } from '@/lib/plugins/types';

vi.mock('@/lib/plugins/host', () => ({
  listAllPlugins: vi.fn(),
}));
vi.mock('@/lib/plugins/context', () => ({
  createPluginContext: vi.fn(() => ({ userId: 'user-1', pluginName: 'test' })),
}));

import { createPluginTools } from '@/lib/chat/plugin-tools';
import { listAllPlugins } from '@/lib/plugins/host';

const USER_ID = 'user-1';

function makeMockPlugin(overrides: Partial<ScratchpadPlugin> = {}): ScratchpadPlugin {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    displayName: 'Test Plugin',
    description: 'A test',
    author: 'test',
    handlesInputTypes: ['text'] as const,
    canHandle: () => true,
    parse: vi.fn(),
    ...overrides,
  };
}

describe('createPluginTools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty object when no plugins have tools', async () => {
    vi.mocked(listAllPlugins).mockResolvedValue([makeMockPlugin()]);
    const tools = await createPluginTools(USER_ID);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it('namespaces tools as pluginName__toolName', async () => {
    vi.mocked(listAllPlugins).mockResolvedValue([
      makeMockPlugin({
        tools: [{ name: 'doThing', description: 'Does a thing', parameters: [{ name: 'input', type: 'string', description: 'Input text', required: true }] }],
        invokeTool: vi.fn().mockResolvedValue({ ok: true }),
      }),
    ]);
    const tools = await createPluginTools(USER_ID);
    expect(tools).toHaveProperty('test-plugin__doThing');
    expect(tools['test-plugin__doThing']).toHaveProperty('execute');
  });

  it('skips plugins without invokeTool method', async () => {
    vi.mocked(listAllPlugins).mockResolvedValue([
      makeMockPlugin({
        tools: [{ name: 'doThing', description: 'Does a thing', parameters: [] }],
        invokeTool: undefined,
      }),
    ]);
    const tools = await createPluginTools(USER_ID);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it('calls plugin.invokeTool when tool is executed', async () => {
    const invokeTool = vi.fn().mockResolvedValue({ result: 42 });
    vi.mocked(listAllPlugins).mockResolvedValue([
      makeMockPlugin({
        tools: [{ name: 'calc', description: 'Calculate', parameters: [{ name: 'x', type: 'number', description: 'Value', required: true }] }],
        invokeTool,
      }),
    ]);
    const tools = await createPluginTools(USER_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools['test-plugin__calc'] as unknown as { execute: (args: Record<string, unknown>, opts: any) => Promise<unknown> }).execute({ x: 5 }, { toolCallId: 'test', messages: [] });
    expect(invokeTool).toHaveBeenCalledWith('calc', { x: 5 }, expect.objectContaining({ userId: USER_ID }));
    expect(result).toEqual({ result: 42 });
  });

  it('includes tools from multiple plugins', async () => {
    vi.mocked(listAllPlugins).mockResolvedValue([
      makeMockPlugin({
        name: 'alpha',
        displayName: 'Alpha',
        tools: [{ name: 'a1', description: 'A1', parameters: [] }],
        invokeTool: vi.fn(),
      }),
      makeMockPlugin({
        name: 'beta',
        displayName: 'Beta',
        tools: [
          { name: 'b1', description: 'B1', parameters: [] },
          { name: 'b2', description: 'B2', parameters: [] },
        ],
        invokeTool: vi.fn(),
      }),
    ]);
    const tools = await createPluginTools(USER_ID);
    expect(Object.keys(tools).sort()).toEqual(['alpha__a1', 'beta__b1', 'beta__b2']);
  });
});
