// lib/scheduler/urgency.ts
// Pure urgency scoring. No IO.

import type { Task } from './types';

/**
 * Returns a numeric urgency score for a task. Higher = schedule sooner.
 *
 * Scale:
 *   base = 5 - priority  (priority 1 → 4.0, priority 4 → 1.0)
 *   + up to 8 deadline boost that grows as the deadline approaches
 *   + 10 if the deadline has already passed
 */
export function scoreUrgency(task: Task, now: Date = new Date()): number {
  // priority 1=urgent..4=low → base 4..1
  const base = 5 - task.priority;

  if (!task.deadline) return base;

  const hoursLeft =
    (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  const taskHours = (task.durationMins ?? 30) / 60;

  if (hoursLeft <= 0) return base + 10;
  if (hoursLeft < taskHours) return base + 8;

  // Boost decays with available time: ~5 at 1 day, ~0.5 at 10 days, capped at 8
  const deadlineBoost = 5 / Math.max(hoursLeft / 24, 0.1);
  return base + Math.min(deadlineBoost, 8);
}
