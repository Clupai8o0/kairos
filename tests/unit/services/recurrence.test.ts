// tests/unit/services/recurrence.test.ts — Unit tests for lib/services/recurrence.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB and ORM
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/lib/db/schema', () => ({
  tasks: { id: 'id', userId: 'user_id', parentTaskId: 'parent_task_id', recurrenceRule: 'recurrence_rule' },
  taskTags: { taskId: 'task_id', tagId: 'tag_id' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ col: a, val: b })),
  or: vi.fn((...args: unknown[]) => args),
  sql: vi.fn((strs: TemplateStringsArray) => strs.join('')),
  count: vi.fn(() => 'COUNT(*)'),
}));
vi.mock('@/lib/utils/id', () => ({ newId: vi.fn(() => 'new-id-1') }));
vi.mock('@/lib/services/tasks', () => ({ deleteTask: vi.fn() }));
vi.mock('@/lib/scheduler/recurrence', () => ({
  nextOccurrenceAfterComplete: vi.fn(() => new Date('2026-05-01T10:00:00Z')),
}));

import { db } from '@/lib/db/client';
import { resolveSeriesRoot } from '@/lib/services/recurrence';

const USER_ID = 'user-1';

function mockDbSelect(rows: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(rows);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
}

describe('resolveSeriesRoot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when task does not exist', async () => {
    mockDbSelect([]);
    const result = await resolveSeriesRoot(USER_ID, 'missing-task');
    expect(result).toBeNull();
  });

  it('returns the task ID itself when it is a root (has recurrenceRule, no parentTaskId)', async () => {
    mockDbSelect([{ id: 'root-1', parentTaskId: null, recurrenceRule: { freq: 'daily', interval: 1 } }]);
    const result = await resolveSeriesRoot(USER_ID, 'root-1');
    expect(result).toBe('root-1');
  });

  it('returns parentTaskId when task is a child (has parentTaskId)', async () => {
    mockDbSelect([{ id: 'child-1', parentTaskId: 'root-1', recurrenceRule: { freq: 'daily', interval: 1 } }]);
    const result = await resolveSeriesRoot(USER_ID, 'child-1');
    expect(result).toBe('root-1');
  });

  it('returns null for a standalone task (no recurrenceRule, no parentTaskId)', async () => {
    mockDbSelect([{ id: 'standalone', parentTaskId: null, recurrenceRule: null }]);
    const result = await resolveSeriesRoot(USER_ID, 'standalone');
    expect(result).toBeNull();
  });
});
