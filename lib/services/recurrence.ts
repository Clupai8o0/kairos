// lib/services/recurrence.ts
import { and, eq, or, sql, count as drizzleCount } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tasks, taskTags } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { nextOccurrenceAfterComplete } from '@/lib/scheduler/recurrence';
import { deleteTask } from '@/lib/services/tasks';
import type { RecurrenceRule } from '@/lib/scheduler/types';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Given any task (root or child), returns the root task's ID.
 * 
 * @param userId - The user ID
 * @param taskId - ID of any task in the series
 * @returns Root task ID, or null if not part of a series
 */
export async function resolveSeriesRoot(
  userId: string,
  taskId: string,
): Promise<string | null> {
  const task = await db
    .select({
      id: tasks.id,
      parentTaskId: tasks.parentTaskId,
      recurrenceRule: tasks.recurrenceRule,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task[0]) return null;

  const { parentTaskId, recurrenceRule } = task[0];

  // If has parent, parent is the root
  if (parentTaskId) return parentTaskId;

  // If has recurrence rule but no parent, this IS the root
  if (recurrenceRule) return taskId;

  // Not part of a series
  return null;
}

/**
 * Creates the next occurrence of a recurring task after completion.
 * 
 * @param userId - The user ID
 * @param taskId - ID of the completed task
 * @param completedAt - When the task was completed
 * @returns New task ID, or null if no next occurrence
 */
export async function spawnNextOccurrence(
  userId: string,
  taskId: string,
  completedAt: Date,
): Promise<string | null> {
  // Load the completed task
  const task = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task[0]) return null;

  const completedTask = task[0];

  // Must have a recurrence rule
  if (!completedTask.recurrenceRule) return null;

  const rule = completedTask.recurrenceRule as RecurrenceRule;

  // Determine root task ID
  const rootId = completedTask.parentTaskId ?? completedTask.id;

  // Count existing instances in the series
  const [countResult] = await db
    .select({ count: drizzleCount() })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        or(
          eq(tasks.id, rootId),
          eq(tasks.parentTaskId, rootId),
        ),
      ),
    );

  const currentInstanceCount = countResult?.count ?? 0;

  // Check if we've reached the count limit
  if (rule.count && currentInstanceCount >= rule.count) {
    return null;
  }

  // Calculate the maximum recurrence index for the new task
  const [maxIndexResult] = await db
    .select({ maxIndex: sql<number>`COALESCE(MAX(${tasks.recurrenceIndex}), 0)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        or(
          eq(tasks.id, rootId),
          eq(tasks.parentTaskId, rootId),
        ),
      ),
    );

  const maxIndex = maxIndexResult?.maxIndex ?? 0;

  // Calculate next scheduled time
  let nextScheduledAt: Date | null;

  if (rule.mode === 'after-complete') {
    nextScheduledAt = nextOccurrenceAfterComplete(rule, completedAt);
  } else {
    // For fixed mode (or undefined), use the task's scheduledAt as anchor
    const anchor = completedTask.scheduledAt ?? completedAt;
    nextScheduledAt = nextOccurrenceAfterComplete(rule, anchor);
  }

  if (!nextScheduledAt) return null;

  // Create the new task
  const newTaskId = newId();
  
  const [newTask] = await db
    .insert(tasks)
    .values({
      id: newTaskId,
      userId,
      // Inherited fields
      title: completedTask.title,
      description: completedTask.description,
      durationMins: completedTask.durationMins,
      priority: completedTask.priority,
      schedulable: completedTask.schedulable,
      bufferMins: completedTask.bufferMins,
      minChunkMins: completedTask.minChunkMins,
      isSplittable: completedTask.isSplittable,
      dependsOn: completedTask.dependsOn,
      recurrenceRule: completedTask.recurrenceRule,
      preferredTemplateId: completedTask.preferredTemplateId,
      source: completedTask.source,
      sourceRef: completedTask.sourceRef,
      // New fields
      parentTaskId: rootId,
      recurrenceIndex: maxIndex + 1,
      status: 'pending',
      scheduledAt: null,
      scheduledEnd: null,
      gcalEventId: null,
      completedAt: null,
      timeLocked: false,
    })
    .returning({ id: tasks.id });

  if (!newTask) return null;

  // Copy tags from the completed task to the new task
  const existingTags = await db
    .select({ tagId: taskTags.tagId })
    .from(taskTags)
    .where(eq(taskTags.taskId, taskId));

  if (existingTags.length > 0) {
    await db.insert(taskTags).values(
      existingTags.map(({ tagId }) => ({
        taskId: newTaskId,
        tagId,
      })),
    );
  }

  return newTaskId;
}

/**
 * Deletes a single task instance.
 * 
 * @param userId - The user ID
 * @param taskId - ID of the task to delete
 * @returns Deleted task info, or null if not found
 */
export async function deleteInstance(
  userId: string,
  taskId: string,
): Promise<{ id: string; gcalEventId: string | null } | null> {
  return deleteTask(userId, taskId);
}

/**
 * Deletes an entire recurring task series.
 * 
 * @param userId - The user ID  
 * @param taskId - ID of any task in the series
 * @returns Deleted task IDs and their gcalEventIds
 */
export async function deleteSeries(
  userId: string,
  taskId: string,
): Promise<{ deletedIds: string[]; gcalEventIds: string[] }> {
  const rootId = await resolveSeriesRoot(userId, taskId);

  if (!rootId) {
    // Not part of a series, just delete the single task
    const result = await deleteTask(userId, taskId);
    if (!result) {
      return { deletedIds: [], gcalEventIds: [] };
    }
    return {
      deletedIds: [result.id],
      gcalEventIds: result.gcalEventId ? [result.gcalEventId] : [],
    };
  }

  // Delete all tasks in the series
  const deleted = await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        or(
          eq(tasks.id, rootId),
          eq(tasks.parentTaskId, rootId),
        ),
      ),
    )
    .returning({ id: tasks.id, gcalEventId: tasks.gcalEventId });

  const deletedIds = deleted.map((t) => t.id);
  const gcalEventIds = deleted
    .filter((t) => t.gcalEventId)
    .map((t) => t.gcalEventId!);

  return { deletedIds, gcalEventIds };
}