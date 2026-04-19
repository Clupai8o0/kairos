// tests/unit/chat-router.test.ts — Unit tests for lib/chat/router.ts and SYSTEM_PROMPT snapshot
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/chat/tools', () => ({
  createCoreTools: vi.fn(() => ({
    listTasks: { description: 'List tasks', inputSchema: {}, execute: vi.fn() },
    createTask: { description: 'Create task', inputSchema: {}, execute: vi.fn() },
    updateTask: { description: 'Update task', inputSchema: {}, execute: vi.fn() },
    deleteTask: { description: 'Delete task', inputSchema: {}, execute: vi.fn() },
    completeTask: { description: 'Complete task', inputSchema: {}, execute: vi.fn() },
    listTags: { description: 'List tags', inputSchema: {}, execute: vi.fn() },
    createTag: { description: 'Create tag', inputSchema: {}, execute: vi.fn() },
    listSchedule: { description: 'List schedule', inputSchema: {}, execute: vi.fn() },
    runSchedule: { description: 'Run schedule', inputSchema: {}, execute: vi.fn() },
  })),
}));

vi.mock('@/lib/chat/plugin-tools', () => ({
  createPluginTools: vi.fn(async () => ({
    'my-plugin__doThing': { description: 'Do thing', inputSchema: {}, execute: vi.fn() },
  })),
}));

import { createAllTools, getAvailableToolNames } from '@/lib/chat/router';
import { SYSTEM_PROMPT } from '@/lib/chat/stream';

const USER_ID = 'user-1';

describe('createAllTools', () => {
  it('includes all core tools', async () => {
    const tools = await createAllTools(USER_ID);
    expect(tools).toHaveProperty('listTasks');
    expect(tools).toHaveProperty('createTask');
    expect(tools).toHaveProperty('updateTask');
    expect(tools).toHaveProperty('deleteTask');
    expect(tools).toHaveProperty('completeTask');
    expect(tools).toHaveProperty('listTags');
    expect(tools).toHaveProperty('createTag');
    expect(tools).toHaveProperty('listSchedule');
    expect(tools).toHaveProperty('runSchedule');
  });

  it('includes plugin tools with namespaced names', async () => {
    const tools = await createAllTools(USER_ID);
    expect(tools).toHaveProperty('my-plugin__doThing');
  });

  it('core and plugin tools merged in single object', async () => {
    const tools = await createAllTools(USER_ID);
    const keys = Object.keys(tools);
    expect(keys).toContain('listTasks');
    expect(keys).toContain('my-plugin__doThing');
  });

  it('unknown tool name returns undefined (AI SDK handles dispatch)', async () => {
    const tools = await createAllTools(USER_ID);
    expect((tools as Record<string, unknown>)['nonExistentTool']).toBeUndefined();
  });
});

describe('getAvailableToolNames', () => {
  it('returns core and plugin names in separate arrays', async () => {
    const { core, plugin } = await getAvailableToolNames(USER_ID);
    expect(core).toContain('listTasks');
    expect(plugin).toContain('my-plugin__doThing');
  });

  it('core tool names are not namespaced (no __)', async () => {
    const { core } = await getAvailableToolNames(USER_ID);
    expect(core.every((name) => !name.includes('__'))).toBe(true);
  });

  it('plugin tool names are namespaced with __', async () => {
    const { plugin } = await getAvailableToolNames(USER_ID);
    expect(plugin.every((name) => name.includes('__'))).toBe(true);
  });
});

describe('SYSTEM_PROMPT snapshot', () => {
  it('matches snapshot', () => {
    expect(SYSTEM_PROMPT).toMatchSnapshot();
  });

  it('mentions Kairos', () => {
    expect(SYSTEM_PROMPT).toContain('Kairos');
  });

  it('describes task management capabilities', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('task');
  });
});
