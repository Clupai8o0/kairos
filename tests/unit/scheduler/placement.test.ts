// tests/unit/scheduler/placement.test.ts
import { describe, expect, it } from 'vitest';
import { placeTask, placementConsumedRange } from '@/lib/scheduler/placement';
import type { ScoredTask, TimeSlot } from '@/lib/scheduler/types';
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
    metadata: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function scored(overrides: Partial<Task> = {}): ScoredTask {
  return { ...makeTask(overrides), urgency: 3 };
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

describe('placeTask', () => {
  it('returns null when no slots', () => {
    const task = scored({ durationMins: 30, bufferMins: 15 });
    expect(placeTask(task, [])).toBeNull();
  });

  it('returns null when all slots are too short (duration only)', () => {
    // Need 30 + 15 = 45 min; slot is only 30 min
    const task = scored({ durationMins: 30, bufferMins: 15 });
    const slots = [slot(0, mins(30))];
    expect(placeTask(task, slots)).toBeNull();
  });

  it('returns null when slot matches duration but not buffer', () => {
    // Need 45 min; slot is 44 min
    const task = scored({ durationMins: 30, bufferMins: 15 });
    const slots = [slot(0, mins(44))];
    expect(placeTask(task, slots)).toBeNull();
  });

  it('places task in exact-fit slot', () => {
    // Slot is exactly 30 + 15 = 45 min
    const task = scored({ durationMins: 30, bufferMins: 15 });
    const slots = [slot(0, mins(45))];
    const result = placeTask(task, slots);
    expect(result).not.toBeNull();
    expect(result!.start).toEqual(new Date(BASE));
    expect(result!.end).toEqual(new Date(BASE.getTime() + mins(30)));
    expect(result!.chunkIndex).toBe(0);
  });

  it('places task at start of larger slot', () => {
    const task = scored({ durationMins: 30, bufferMins: 15 });
    const slots = [slot(0, mins(480))]; // 8-hour slot
    const result = placeTask(task, slots)!;
    expect(result.start).toEqual(new Date(BASE));
    expect(result.end).toEqual(new Date(BASE.getTime() + mins(30)));
  });

  it('skips first too-small slot and uses second', () => {
    const task = scored({ durationMins: 30, bufferMins: 15 });
    const slots = [
      slot(0, mins(20)),       // too small
      slot(mins(60), mins(180)), // 2-hour slot — fits
    ];
    const result = placeTask(task, slots)!;
    expect(result.start).toEqual(new Date(BASE.getTime() + mins(60)));
  });

  it('end is start + durationMins (buffer not in event)', () => {
    const task = scored({ durationMins: 60, bufferMins: 20 });
    const slots = [slot(0, mins(120))];
    const result = placeTask(task, slots)!;
    const expectedEnd = new Date(result.start.getTime() + mins(60));
    expect(result.end).toEqual(expectedEnd);
  });
});

describe('placementConsumedRange', () => {
  it('extends end by bufferMins', () => {
    const task = scored({ durationMins: 30, bufferMins: 15 });
    const chunk = {
      start: BASE,
      end: new Date(BASE.getTime() + mins(30)),
      chunkIndex: 0,
    };
    const range = placementConsumedRange(task, chunk);
    expect(range.start).toEqual(BASE);
    expect(range.end).toEqual(new Date(BASE.getTime() + mins(45)));
  });
});
