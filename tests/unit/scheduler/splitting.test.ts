// tests/unit/scheduler/splitting.test.ts
import { describe, expect, it } from 'vitest';
import { splitTask } from '@/lib/scheduler/splitting';
import type { ScoredTask, TimeSlot } from '@/lib/scheduler/types';
import type { Task } from '@/lib/db/schema/tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test',
    description: null,
    durationMins: 60,
    deadline: null,
    priority: 3,
    status: 'pending',
    schedulable: true,
    gcalEventId: null,
    scheduledAt: null,
    scheduledEnd: null,
    bufferMins: 15,
    minChunkMins: 15,
    isSplittable: true,
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

function scored(overrides: Partial<Task> = {}): ScoredTask {
  return { ...makeTask(overrides), urgency: 2 };
}

function mins(n: number): number {
  return n * 60 * 1000;
}

const BASE = new Date('2026-04-20T09:00:00Z');

function slot(startOffsetMs: number, endOffsetMs: number): TimeSlot {
  return {
    start: new Date(BASE.getTime() + startOffsetMs),
    end: new Date(BASE.getTime() + endOffsetMs),
  };
}

describe('splitTask', () => {
  it('returns null when isSplittable is false', () => {
    const task = scored({ isSplittable: false });
    const slots = [slot(0, mins(60))];
    expect(splitTask(task, slots)).toBeNull();
  });

  it('returns null when all slots are smaller than minChunkMins', () => {
    const task = scored({ durationMins: 60, minChunkMins: 20 });
    const slots = [
      slot(0, mins(10)),
      slot(mins(30), mins(40)), // 10 min — below 20 min min
    ];
    expect(splitTask(task, slots)).toBeNull();
  });

  it('returns null when total available is less than durationMins', () => {
    const task = scored({ durationMins: 90, minChunkMins: 15 });
    const slots = [
      slot(0, mins(30)),
      slot(mins(60), mins(90)), // total 60 min < 90 min needed
    ];
    expect(splitTask(task, slots)).toBeNull();
  });

  it('places entire task in a single large slot', () => {
    const task = scored({ durationMins: 60, minChunkMins: 15 });
    const slots = [slot(0, mins(120))];
    const result = splitTask(task, slots);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].chunkIndex).toBe(0);
    // Chunk covers the full durationMins
    const chunkMs = result![0].end.getTime() - result![0].start.getTime();
    expect(chunkMs).toBe(mins(60));
  });

  it('splits across two slots', () => {
    const task = scored({ durationMins: 60, minChunkMins: 15 });
    const slots = [
      slot(0, mins(30)),          // first 30 min
      slot(mins(60), mins(120)),  // next 60 min available (need 30 more)
    ];
    const result = splitTask(task, slots);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].chunkIndex).toBe(0);
    expect(result![1].chunkIndex).toBe(1);

    const total =
      result!.reduce((s, c) => s + c.end.getTime() - c.start.getTime(), 0);
    expect(total).toBe(mins(60));
  });

  it('skips slots smaller than minChunkMins', () => {
    const task = scored({ durationMins: 60, minChunkMins: 20 });
    const slots = [
      slot(0, mins(10)),          // 10 min — too small, skipped
      slot(mins(30), mins(60)),   // 30 min chunk
      slot(mins(90), mins(120)),  // 30 min chunk
    ];
    const result = splitTask(task, slots);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it('chunk indices are sequential from 0', () => {
    const task = scored({ durationMins: 60, minChunkMins: 15 });
    const slots = [
      slot(0, mins(20)),
      slot(mins(30), mins(50)),
      slot(mins(60), mins(80)),
    ];
    const result = splitTask(task, slots)!;
    result.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('uses minChunkMins default of 15 when null', () => {
    const task = scored({ durationMins: 60, minChunkMins: null });
    // Slot of 14 min should be skipped (below 15 min default)
    const slots = [
      slot(0, mins(14)),
      slot(mins(30), mins(90)), // 60 min — fits entire task
    ];
    const result = splitTask(task, slots);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
  });
});
