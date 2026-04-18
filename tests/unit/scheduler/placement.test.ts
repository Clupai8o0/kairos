// tests/unit/scheduler/placement.test.ts
import { describe, expect, it } from 'vitest';
import { placeTask, placementConsumedRange, rankSlotsForTask } from '@/lib/scheduler/placement';
import type { ScoredTask, TimeSlot, WindowTemplate } from '@/lib/scheduler/types';
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

describe('rankSlotsForTask', () => {
  const templates: WindowTemplate[] = [
    { id: 'tpl-work', name: 'Work', isDefault: true },
    { id: 'tpl-personal', name: 'Personal', isDefault: false },
  ];

  const slotsWithTemplates: TimeSlot[] = [
    { start: new Date(BASE.getTime()), end: new Date(BASE.getTime() + mins(60)), templateId: 'tpl-work' },
    { start: new Date(BASE.getTime() + mins(120)), end: new Date(BASE.getTime() + mins(180)), templateId: 'tpl-personal' },
    { start: new Date(BASE.getTime() + mins(240)), end: new Date(BASE.getTime() + mins(300)), templateId: 'tpl-work' },
  ];

  it('returns slots unchanged when task has no preference', () => {
    const task = scored({ preferredTemplateId: null });
    const result = rankSlotsForTask(slotsWithTemplates, task, templates);
    expect(result).toEqual(slotsWithTemplates);
  });

  it('prioritises slots matching preferred template', () => {
    const task = scored({ preferredTemplateId: 'tpl-personal' });
    const result = rankSlotsForTask(slotsWithTemplates, task, templates);
    // Personal slot should be first, then the two work slots in original order
    expect(result[0].templateId).toBe('tpl-personal');
    expect(result[1].templateId).toBe('tpl-work');
    expect(result[2].templateId).toBe('tpl-work');
  });

  it('preserves chronological order within each partition', () => {
    const task = scored({ preferredTemplateId: 'tpl-work' });
    const result = rankSlotsForTask(slotsWithTemplates, task, templates);
    // Two work slots first (in original order), then personal
    expect(result[0]).toEqual(slotsWithTemplates[0]);
    expect(result[1]).toEqual(slotsWithTemplates[2]);
    expect(result[2]).toEqual(slotsWithTemplates[1]);
  });

  it('falls back to all slots when preferred template has no matching slots', () => {
    const task = scored({ preferredTemplateId: 'tpl-nonexistent' });
    const result = rankSlotsForTask(slotsWithTemplates, task, templates);
    // All slots in rest partition, original order
    expect(result).toEqual(slotsWithTemplates);
  });
});
