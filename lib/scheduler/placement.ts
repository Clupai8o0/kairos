// lib/scheduler/placement.ts
// Assigns a single task to the first available slot. Pure — no IO.

import type { ScoredTask, TimeSlot, PlacedChunk } from './types';

/**
 * Finds the first slot that has room for the task (duration + buffer).
 *
 * Buffer is consumed from the slot to prevent back-to-back scheduling, but
 * the returned chunk's `end` is at `start + durationMins` — the buffer is
 * not part of the GCal event.
 *
 * Returns null if no suitable slot exists.
 */
export function placeTask(
  task: ScoredTask,
  slots: TimeSlot[],
): PlacedChunk | null {
  const durationMs = (task.durationMins ?? 30) * 60 * 1000;
  const bufferMs = task.bufferMins * 60 * 1000;
  const required = durationMs + bufferMs;

  for (const slot of slots) {
    const available = slot.end.getTime() - slot.start.getTime();
    if (available >= required) {
      return {
        start: slot.start,
        end: new Date(slot.start.getTime() + durationMs),
        chunkIndex: 0,
      };
    }
  }

  return null;
}

/**
 * The range that should be consumed from the slot list after placing a task.
 * This is `start` to `end + bufferMins`, so the buffer gap is reserved.
 */
export function placementConsumedRange(
  task: ScoredTask,
  chunk: PlacedChunk,
): { start: Date; end: Date } {
  const bufferMs = task.bufferMins * 60 * 1000;
  return {
    start: chunk.start,
    end: new Date(chunk.end.getTime() + bufferMs),
  };
}
