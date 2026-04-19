// tests/unit/chat-tools.test.ts — Unit tests for core chat tools
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/tasks', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
}));
vi.mock('@/lib/services/tags', () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
}));
vi.mock('@/lib/services/jobs', () => ({
  enqueueJob: vi.fn(),
}));
vi.mock('@/lib/services/recurrence', () => ({
  spawnNextOccurrence: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })) },
}));
vi.mock('@/lib/db/schema', () => ({
  tasks: {},
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

import { createCoreTools } from '@/lib/chat/tools';
import { listTasks, createTask, updateTask, deleteTask, getTask } from '@/lib/services/tasks';
import { listTags, createTag } from '@/lib/services/tags';
import { enqueueJob } from '@/lib/services/jobs';
import { spawnNextOccurrence } from '@/lib/services/recurrence';

const USER_ID = 'user-1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exec(toolObj: any, args: Record<string, unknown> = {}) {
  return toolObj.execute(args, { toolCallId: 'test', messages: [] });
}

describe('createCoreTools', () => {
  beforeEach(() => vi.clearAllMocks());

  const tools = createCoreTools(USER_ID);

  it('listTasks calls service with userId and filters', async () => {
    vi.mocked(listTasks).mockResolvedValue([]);
    const result = await exec(tools.listTasks, { status: 'pending' });
    expect(listTasks).toHaveBeenCalledWith(USER_ID, { status: 'pending', tagId: undefined });
    expect(result).toEqual([]);
  });

  it('createTask calls service and enqueues job for schedulable task', async () => {
    vi.mocked(createTask).mockResolvedValue({
      id: 't1', title: 'Do thing', status: 'pending', schedulable: true,
    } as never);
    vi.mocked(enqueueJob).mockResolvedValue(undefined as never);

    const result = await exec(tools.createTask, { title: 'Do thing', priority: 3, schedulable: true, bufferMins: 15, isSplittable: false, tagIds: [] });
    expect(createTask).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ title: 'Do thing' }));
    expect(enqueueJob).toHaveBeenCalledWith('schedule:single-task', expect.objectContaining({ userId: USER_ID }));
    expect(result).toEqual(expect.objectContaining({ id: 't1', schedulable: true }));
  });

  it('createTask does NOT enqueue job when schedulable is false', async () => {
    vi.mocked(createTask).mockResolvedValue({
      id: 't2', title: 'Note', status: 'pending', schedulable: false,
    } as never);

    await exec(tools.createTask, { title: 'Note', priority: 3, schedulable: false, bufferMins: 0, isSplittable: false, tagIds: [] });
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it('updateTask calls service and returns updated task', async () => {
    vi.mocked(updateTask).mockResolvedValue({ id: 't1', title: 'Updated', status: 'pending' } as never);
    const result = await exec(tools.updateTask, { id: 't1', title: 'Updated' });
    expect(updateTask).toHaveBeenCalledWith(USER_ID, 't1', { title: 'Updated' });
    expect(result).toEqual({ id: 't1', title: 'Updated', status: 'pending' });
  });

  it('updateTask returns error when task not found', async () => {
    vi.mocked(updateTask).mockResolvedValue(null as never);
    const result = await exec(tools.updateTask, { id: 'nope', title: 'X' });
    expect(result).toEqual({ error: 'Task not found' });
  });

  it('deleteTask calls service and returns deleted confirmation', async () => {
    vi.mocked(deleteTask).mockResolvedValue({ id: 't1' } as never);
    const result = await exec(tools.deleteTask, { id: 't1' });
    expect(deleteTask).toHaveBeenCalledWith(USER_ID, 't1');
    expect(result).toEqual({ deleted: true, id: 't1' });
  });

  it('deleteTask returns error when task not found', async () => {
    vi.mocked(deleteTask).mockResolvedValue(null as never);
    const result = await exec(tools.deleteTask, { id: 'nope' });
    expect(result).toEqual({ error: 'Task not found' });
  });

  it('completeTask marks task done and spawns next occurrence for recurring', async () => {
    vi.mocked(getTask).mockResolvedValue({ id: 't1', title: 'Daily', status: 'pending', recurrenceRule: 'RRULE:FREQ=DAILY' } as never);
    vi.mocked(spawnNextOccurrence).mockResolvedValue('t2');
    vi.mocked(enqueueJob).mockResolvedValue(undefined as never);

    const result = await exec(tools.completeTask, { id: 't1' });
    expect(getTask).toHaveBeenCalledWith(USER_ID, 't1');
    expect(spawnNextOccurrence).toHaveBeenCalledWith(USER_ID, 't1', expect.any(Date));
    expect(enqueueJob).toHaveBeenCalledWith('schedule:single-task', expect.objectContaining({ payload: { taskId: 't2' } }));
    expect(result).toEqual({ id: 't1', title: 'Daily', status: 'done' });
  });

  it('completeTask returns alreadyDone for already-completed task', async () => {
    vi.mocked(getTask).mockResolvedValue({ id: 't1', title: 'Done', status: 'done' } as never);
    const result = await exec(tools.completeTask, { id: 't1' });
    expect(result).toEqual(expect.objectContaining({ alreadyDone: true }));
  });

  it('listTags calls service', async () => {
    vi.mocked(listTags).mockResolvedValue([{ id: 'tag1', name: 'Work', color: '#ff0000' }] as never);
    const result = await exec(tools.listTags);
    expect(listTags).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual([{ id: 'tag1', name: 'Work', color: '#ff0000' }]);
  });

  it('createTag calls service', async () => {
    vi.mocked(createTag).mockResolvedValue({ id: 'tag2', name: 'Personal', color: '#00ff00' } as never);
    const result = await exec(tools.createTag, { name: 'Personal', color: '#00ff00' });
    expect(createTag).toHaveBeenCalledWith(USER_ID, { name: 'Personal', color: '#00ff00' });
    expect(result).toEqual({ id: 'tag2', name: 'Personal', color: '#00ff00' });
  });

  it('listSchedule calls listTasks with status scheduled', async () => {
    vi.mocked(listTasks).mockResolvedValue([]);
    await exec(tools.listSchedule);
    expect(listTasks).toHaveBeenCalledWith(USER_ID, { status: 'scheduled' });
  });

  it('runSchedule enqueues a full-run job', async () => {
    vi.mocked(enqueueJob).mockResolvedValue(undefined as never);
    const result = await exec(tools.runSchedule);
    expect(enqueueJob).toHaveBeenCalledWith('schedule:full-run', expect.objectContaining({ userId: USER_ID }));
    expect(result).toEqual(expect.objectContaining({ enqueued: true }));
  });
});

// Helper: the AI SDK wraps inputSchema in FlexibleSchema — cast to Zod for safeParse
function parseSchema(schema: unknown, input: unknown): { success: boolean } {
  return (schema as { safeParse: (v: unknown) => { success: boolean } }).safeParse(input);
}

describe('Tool inputSchema validation', () => {
  const tools = createCoreTools(USER_ID);

  it('listTasks rejects unknown status value', () => {
    expect(parseSchema(tools.listTasks.inputSchema, { status: 'flying' }).success).toBe(false);
  });

  it('listTasks accepts valid status', () => {
    expect(parseSchema(tools.listTasks.inputSchema, { status: 'pending' }).success).toBe(true);
  });

  it('listTasks accepts empty object (no filters)', () => {
    expect(parseSchema(tools.listTasks.inputSchema, {}).success).toBe(true);
  });

  it('createTask requires title', () => {
    expect(parseSchema(tools.createTask.inputSchema, { priority: 3 }).success).toBe(false);
  });

  it('createTask rejects priority outside 1–4', () => {
    expect(parseSchema(tools.createTask.inputSchema, { title: 'Test', priority: 10 }).success).toBe(false);
  });

  it('createTask accepts valid minimal input', () => {
    expect(parseSchema(tools.createTask.inputSchema, { title: 'Test' }).success).toBe(true);
  });

  it('updateTask requires id', () => {
    expect(parseSchema(tools.updateTask.inputSchema, { title: 'New title' }).success).toBe(false);
  });

  it('deleteTask requires id', () => {
    expect(parseSchema(tools.deleteTask.inputSchema, {}).success).toBe(false);
  });

  it('completeTask requires id', () => {
    expect(parseSchema(tools.completeTask.inputSchema, {}).success).toBe(false);
  });

  it('createTag requires name', () => {
    expect(parseSchema(tools.createTag.inputSchema, {}).success).toBe(false);
  });

  it('createTag accepts name without color', () => {
    expect(parseSchema(tools.createTag.inputSchema, { name: 'Work' }).success).toBe(true);
  });
});
