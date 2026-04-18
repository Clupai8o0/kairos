// tests/unit/scheduler/candidates.test.ts
import { describe, expect, it } from 'vitest';
import { selectCandidates, buildDoneSet } from '@/lib/scheduler/candidates';
import type { Task } from '@/lib/db/schema/tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test',
    description: null,
    durationMins: 30,
    deadline: null,
    priority: 3,
    status: 'pending',
    schedulable: true,
    gcalEventId: null,
    scheduledAt: null,
    scheduledEnd: null,
    bufferMins: 15,
    minChunkMins: null,
    isSplittable: false,
    dependsOn: [],
    recurrenceRule: null,
    parentTaskId: null,
    recurrenceIndex: null,
    source: null,
    sourceRef: null,
    sourceMetadata: {},
    completedAt: null,
    timeLocked: false,
    preferredTemplateId: null,
    metadata: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const NOW = new Date('2026-04-16T12:00:00Z');

describe('selectCandidates', () => {
  it('includes pending schedulable tasks', () => {
    const task = makeTask({ id: 'a', status: 'pending', schedulable: true });
    const result = selectCandidates([task], new Set(), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('includes scheduled tasks (re-placement allowed)', () => {
    const task = makeTask({ id: 'a', status: 'scheduled', schedulable: true });
    const result = selectCandidates([task], new Set(), NOW);
    expect(result).toHaveLength(1);
  });

  it('excludes tasks with schedulable=false', () => {
    const task = makeTask({ schedulable: false });
    const result = selectCandidates([task], new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes done tasks', () => {
    const task = makeTask({ status: 'done' });
    const result = selectCandidates([task], new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes cancelled tasks', () => {
    const task = makeTask({ status: 'cancelled' });
    const result = selectCandidates([task], new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes tasks with unmet dependency', () => {
    const task = makeTask({ id: 'b', dependsOn: ['a'] });
    const result = selectCandidates([task], new Set(), NOW); // 'a' not in doneSet
    expect(result).toHaveLength(0);
  });

  it('includes tasks whose dependency is in doneSet', () => {
    const dep = makeTask({ id: 'a', status: 'done' });
    const task = makeTask({ id: 'b', dependsOn: ['a'] });
    const doneSet = new Set(['a']);
    const result = selectCandidates([dep, task], doneSet, NOW);
    // 'a' is done so excluded from candidates; 'b' has met dep so included
    expect(result.map((t) => t.id)).toContain('b');
    expect(result.map((t) => t.id)).not.toContain('a');
  });

  it('sorts by urgency descending', () => {
    const urgent = makeTask({ id: 'urgent', priority: 1 }); // base 4
    const low = makeTask({ id: 'low', priority: 4 });       // base 1
    const result = selectCandidates([low, urgent], new Set(), NOW);
    expect(result[0].id).toBe('urgent');
    expect(result[1].id).toBe('low');
  });

  it('attaches urgency score to each task', () => {
    const task = makeTask({ priority: 2 });
    const result = selectCandidates([task], new Set(), NOW);
    expect(typeof result[0].urgency).toBe('number');
    expect(result[0].urgency).toBeGreaterThan(0);
  });

  it('returns empty for empty input', () => {
    expect(selectCandidates([], new Set(), NOW)).toHaveLength(0);
  });
});

describe('buildDoneSet', () => {
  it('includes done and scheduled task ids', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', status: 'done' }),
      makeTask({ id: 'b', status: 'scheduled' }),
      makeTask({ id: 'c', status: 'pending' }),
    ];
    const set = buildDoneSet(tasks);
    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(false);
  });
});
