// tests/unit/scheduler/urgency.test.ts
import { describe, expect, it } from 'vitest';
import { scoreUrgency } from '@/lib/scheduler/urgency';
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

describe('scoreUrgency', () => {
  describe('base score (no deadline)', () => {
    it('priority 1 → base 4', () => {
      expect(scoreUrgency(makeTask({ priority: 1 }), NOW)).toBeCloseTo(4, 5);
    });

    it('priority 2 → base 3', () => {
      expect(scoreUrgency(makeTask({ priority: 2 }), NOW)).toBeCloseTo(3, 5);
    });

    it('priority 3 → base 2', () => {
      expect(scoreUrgency(makeTask({ priority: 3 }), NOW)).toBeCloseTo(2, 5);
    });

    it('priority 4 → base 1', () => {
      expect(scoreUrgency(makeTask({ priority: 4 }), NOW)).toBeCloseTo(1, 5);
    });
  });

  describe('deadline boost', () => {
    it('past deadline → base + 10', () => {
      const task = makeTask({
        priority: 2,
        deadline: new Date('2026-04-15T00:00:00Z'), // yesterday
      });
      expect(scoreUrgency(task, NOW)).toBeCloseTo(13, 5); // base 3 + 10
    });

    it('deadline within task duration → base + 8', () => {
      // Task is 60 min, deadline is 30 min away
      const deadline = new Date(NOW.getTime() + 30 * 60 * 1000);
      const task = makeTask({ priority: 3, durationMins: 60, deadline });
      expect(scoreUrgency(task, NOW)).toBeCloseTo(10, 5); // base 2 + 8
    });

    it('deadline ~1 day away → boost ~5', () => {
      const deadline = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
      const task = makeTask({ priority: 3, deadline });
      // boost = 5 / (24/24) = 5, capped at 8
      const score = scoreUrgency(task, NOW);
      expect(score).toBeGreaterThan(6.9);
      expect(score).toBeLessThanOrEqual(7.1);
    });

    it('deadline ~10 days away → small boost', () => {
      const deadline = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
      const task = makeTask({ priority: 3, deadline });
      const score = scoreUrgency(task, NOW);
      // base 2 + 5/10 = 2.5
      expect(score).toBeGreaterThan(2.4);
      expect(score).toBeLessThan(2.7);
    });

    it('boost is capped at 8', () => {
      // Just past the "within task duration" threshold — fraction of an hour left
      const deadline = new Date(NOW.getTime() + 20 * 60 * 1000); // 20 min
      const task = makeTask({ priority: 1, durationMins: 15, deadline }); // 5 min buffer
      const score = scoreUrgency(task, NOW);
      // 20 min left > 15 min task duration → formula path, but boost should be huge and capped
      expect(score).toBeLessThanOrEqual(4 + 8 + 0.01);
    });

    it('higher priority task beats lower priority at same deadline proximity', () => {
      const deadline = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
      const urgent = scoreUrgency(makeTask({ priority: 1, deadline }), NOW);
      const low = scoreUrgency(makeTask({ priority: 4, deadline }), NOW);
      expect(urgent).toBeGreaterThan(low);
    });
  });
});
