// lib/scheduler/splitting.ts
// Splits a long splittable task across multiple free slots. Pure — no IO.

import type { ScoredTask, TimeSlot, PlacedChunk } from './types';

/**
 * Attempts to split a task across available slots.
 *
 * Only applies when `task.isSplittable === true`. Callers should try
 * `placeTask` from placement.ts first — splitting is the fallback.
 *
 * Returns an array of chunks (in slot order) if the full duration can be
 * covered, or `null` if there is not enough total free time even when split.
 */
export function splitTask(
  task: ScoredTask,
  slots: TimeSlot[],
): PlacedChunk[] | null {
  if (!task.isSplittable) return null;

  const totalMs = (task.durationMins ?? 30) * 60 * 1000;
  const minChunkMs = (task.minChunkMins ?? 15) * 60 * 1000;

  const chunks: PlacedChunk[] = [];
  let remainingMs = totalMs;
  let chunkIndex = 0;

  for (const slot of slots) {
    if (remainingMs <= 0) break;

    const available = slot.end.getTime() - slot.start.getTime();
    if (available < minChunkMs) continue; // too small for a useful chunk

    const chunkMs = Math.min(available, remainingMs);
    chunks.push({
      start: slot.start,
      end: new Date(slot.start.getTime() + chunkMs),
      chunkIndex: chunkIndex++,
    });
    remainingMs -= chunkMs;
  }

  if (remainingMs > 0) return null; // couldn't allocate full duration
  return chunks;
}
