// lib/scheduler/candidates.ts
// Filters and ranks tasks that are ready to be scheduled. Pure — no IO.

import type { Task, ScoredTask } from './types';
import { scoreUrgency } from './urgency';

/**
 * Returns tasks that are ready to schedule, sorted by urgency descending.
 *
 * @param tasks        Full task list for the user
 * @param doneTaskIds  IDs of tasks whose dependencies are considered satisfied
 *                     (caller builds this from tasks with status 'done' or 'scheduled')
 * @param now          Current time (injectable for testing)
 */
export function selectCandidates(
  tasks: Task[],
  doneTaskIds: Set<string>,
  now: Date = new Date(),
): ScoredTask[] {
  return tasks
    .filter((t) => {
      if (!t.schedulable) return false;
      if (t.timeLocked) return false; // time is user-locked; skip until past (runner unlocks it)
      if (t.status !== 'pending' && t.status !== 'scheduled') return false;
      if (t.dependsOn.length > 0) {
        if (!t.dependsOn.every((depId) => doneTaskIds.has(depId))) return false;
      }
      return true;
    })
    .map((t) => ({ ...t, urgency: scoreUrgency(t, now) }))
    .sort((a, b) => b.urgency - a.urgency);
}

/**
 * Convenience: builds the doneTaskIds set from a task list.
 * A task satisfies a dependency when its status is 'done' or 'scheduled'.
 */
export function buildDoneSet(tasks: Task[]): Set<string> {
  const ids = new Set<string>();
  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'scheduled') ids.add(t.id);
  }
  return ids;
}
