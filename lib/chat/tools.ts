// lib/chat/tools.ts — Core tool catalogue for chat surface
import { tool } from 'ai';
import { z } from 'zod';
import {
  listTasks,
  createTask,
  createTasksBulk,
  updateTask,
  deleteTask,
  getTask,
} from '@/lib/services/tasks';
import { listTags, createTag, type Tag } from '@/lib/services/tags';
import { enqueueJob } from '@/lib/services/jobs';
import { spawnNextOccurrence } from '@/lib/services/recurrence';
import { getWriteCalendarId } from '@/lib/gcal/calendars';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

async function resolveTagNames(userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await listTags(userId);
  const byName = new Map(existing.map((t: Tag) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of names) {
    const found = byName.get(name.toLowerCase());
    if (found) {
      ids.push(found);
    } else {
      const created = await createTag(userId, { name });
      byName.set(name.toLowerCase(), created.id);
      ids.push(created.id);
    }
  }
  return ids;
}

export function createCoreTools(userId: string, opts?: { skipConfirmation?: boolean }) {
  const needsApproval = !opts?.skipConfirmation;
  return {
    listTasks: tool({
      description:
        'List all tasks for the current user. Always call this WITHOUT filters first when looking for a task by name. Only use status filter when the user explicitly asks for tasks in a specific status.',
      inputSchema: z.object({
        status: z
          .enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled'])
          .optional()
          .describe('Filter by task status — omit to list ALL tasks'),
        tagId: z.string().optional().describe('Filter by tag ID'),
      }),
      execute: async (args) => {
        const result = await listTasks(userId, {
          status: args.status,
          tagId: args.tagId,
        });
        return result.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          durationMins: t.durationMins,
          scheduledAt: t.scheduledAt,
          deadline: t.deadline,
          tags: t.tags.map((tag) => tag.name),
        }));
      },
    }),

    createTask: tool({
      description:
        'Create a new task and enqueue it for automatic scheduling.',
      needsApproval,
      inputSchema: z.object({
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        durationMins: z.number().int().positive().optional().describe('Duration in minutes'),
        priority: z.number().int().min(1).max(4).default(3).describe('Priority 1 (highest) to 4 (lowest)'),
        schedulable: z.boolean().default(true).describe('Whether the task can be auto-scheduled'),
        bufferMins: z.number().int().min(0).default(15).describe('Buffer minutes after the task'),
        isSplittable: z.boolean().default(false).describe('Whether the task can be split into chunks'),
        tags: z.array(z.string()).default([]).describe('Tag names to attach (created automatically if they don\'t exist)'),
        deadline: z.string().optional().describe('ISO 8601 deadline date (YYYY-MM-DD)'),
        timeLocked: z.boolean().default(false).describe('Pin the task to a specific time — the auto-scheduler will not move it'),
        scheduledAt: z.string().optional().describe('ISO 8601 datetime WITH timezone offset (e.g. 2026-04-27T09:00:00+01:00). Required when timeLocked is true.'),
        scheduledEnd: z.string().optional().describe('ISO 8601 datetime WITH timezone offset. Required when timeLocked is true.'),
        force: z.boolean().default(false).describe('Set to true to create even if a task with the same title already exists'),
      }),
      execute: async (args) => {
        // Duplicate detection: warn if a task with the same title exists
        if (!args.force) {
          const existing = await listTasks(userId, {});
          const duplicate = existing.find(
            (t) => t.title.toLowerCase() === args.title.toLowerCase() && t.status !== 'done' && t.status !== 'cancelled',
          );
          if (duplicate) {
            return {
              duplicate: true,
              existingTask: { id: duplicate.id, title: duplicate.title, status: duplicate.status },
              message: `A task called "${duplicate.title}" already exists (status: ${duplicate.status}). Ask the user to confirm, then call createTask again with force: true to create it anyway.`,
            };
          }
        }

        const tagIds = await resolveTagNames(userId, args.tags);
        const isLocked = args.timeLocked && !!args.scheduledAt;
        const task = await createTask(userId, {
          title: args.title,
          description: args.description,
          durationMins: args.durationMins,
          priority: args.priority,
          schedulable: args.schedulable,
          bufferMins: args.bufferMins,
          isSplittable: args.isSplittable,
          tagIds,
          deadline: args.deadline,
          timeLocked: isLocked,
          scheduledAt: args.scheduledAt,
          scheduledEnd: args.scheduledEnd,
          status: isLocked ? 'scheduled' : 'pending',
          dependsOn: [],
        });

        if (isLocked && args.scheduledAt && args.scheduledEnd) {
          // Create GCal event for the locked task fire-and-forget
          import('@/lib/gcal/events').then(async ({ createEvent }) => {
            const { db: dbClient } = await import('@/lib/db/client');
            const { eq: dbEq } = await import('drizzle-orm');
            const calendarId = await getWriteCalendarId(userId);
            const event = await createEvent(userId, calendarId, {
              summary: task.title,
              description: task.description ?? undefined,
              start: args.scheduledAt!,
              end: args.scheduledEnd!,
            });
            await dbClient
              .update(tasks)
              .set({ gcalEventId: event.id })
              .where(and(dbEq(tasks.id, task.id), dbEq(tasks.userId, userId)));
          }).catch(() => {});

          // Re-schedule other tasks around the newly locked slot
          await enqueueJob('schedule:full-run', {
            userId,
            idempotencyKey: `schedule:full-run:${userId}:${Date.now()}`,
          });
        } else if (task.schedulable) {
          await enqueueJob('schedule:single-task', {
            userId,
            payload: { taskId: task.id },
            idempotencyKey: `schedule:${task.id}:${Date.now()}`,
          });
        }

        return {
          id: task.id,
          title: task.title,
          status: task.status,
          schedulable: task.schedulable,
          timeLocked: task.timeLocked,
          scheduledAt: task.scheduledAt,
        };
      },
    }),

    bulkCreateTasks: tool({
      description:
        'Create multiple tasks at once from a single prompt. Use this instead of createTask when the user wants to create 2 or more tasks.',
      needsApproval,
      inputSchema: z.object({
        tasks: z
          .array(
            z.object({
              title: z.string().describe('Task title'),
              description: z.string().optional().describe('Task description'),
              durationMins: z.number().int().positive().optional().describe('Duration in minutes'),
              priority: z.number().int().min(1).max(4).default(3).describe('Priority 1 (highest) to 4 (lowest)'),
              schedulable: z.boolean().default(true).describe('Whether the task can be auto-scheduled'),
              bufferMins: z.number().int().min(0).default(15).describe('Buffer minutes after the task'),
              isSplittable: z.boolean().default(false).describe('Whether the task can be split into chunks'),
              tags: z.array(z.string()).default([]).describe('Tag names to attach (created automatically if they don\'t exist)'),
              deadline: z.string().optional().describe('ISO 8601 deadline'),
            }),
          )
          .min(1)
          .max(25)
          .describe('Array of tasks to create'),
      }),
      execute: async (args) => {
        const allNames = [...new Set(args.tasks.flatMap((t) => t.tags))];
        const resolvedMap = new Map<string, string>();
        const resolvedIds = await resolveTagNames(userId, allNames);
        allNames.forEach((name, i) => resolvedMap.set(name.toLowerCase(), resolvedIds[i]));

        const created = await createTasksBulk(
          userId,
          args.tasks.map((t) => ({
            ...t,
            tagIds: t.tags.map((n) => resolvedMap.get(n.toLowerCase())!),
            dependsOn: [],
          })),
        );

        const schedulable = created.filter((t) => t.schedulable);
        if (schedulable.length > 0) {
          await enqueueJob('schedule:full-run', {
            userId,
            idempotencyKey: `bulk-schedule:${userId}:${Date.now()}`,
          });
        }

        return {
          created: created.length,
          tasks: created.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            schedulable: t.schedulable,
          })),
        };
      },
    }),

    updateTask: tool({
      description: 'Update an existing task by ID.',
      needsApproval,
      inputSchema: z.object({
        id: z.string().describe('Task ID to update'),
        taskName: z.string().optional().describe('Current task title (for display in confirmation UI — always include this)'),
        title: z.string().optional(),
        description: z.string().optional(),
        durationMins: z.number().int().positive().optional(),
        priority: z.number().int().min(1).max(4).optional(),
        schedulable: z.boolean().optional(),
        timeLocked: z.boolean().optional().describe('Set false to unlock the task so the auto-scheduler can move it'),
        bufferMins: z.number().int().min(0).optional(),
        isSplittable: z.boolean().optional(),
        tags: z.array(z.string()).optional().describe('Tag names to set (created automatically if they don\'t exist)'),
        deadline: z.string().nullable().optional(),
        status: z
          .enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled'])
          .optional(),
      }),
      execute: async (args) => {
        const { id, tags: tagNames, taskName: _taskName, ...rest } = args;
        const tagIds = tagNames ? await resolveTagNames(userId, tagNames) : undefined;
        const task = await updateTask(userId, id, { ...rest, tagIds });
        if (!task) return { error: 'Task not found' };

        const becomesTerminal = rest.status === 'done' || rest.status === 'cancelled';
        const becomesNonSchedulable = rest.schedulable === false;
        if ((becomesTerminal || becomesNonSchedulable) && task.gcalEventId) {
          const gcalEventId = task.gcalEventId;
          Promise.all([import('@/lib/gcal/events'), getWriteCalendarId(userId)])
            .then(([{ deleteEvent }, calId]) => deleteEvent(userId, calId, gcalEventId))
            .catch(() => {});
        }

        return { id: task.id, title: task.title, status: task.status };
      },
    }),

    deleteTask: tool({
      description: 'Delete a task by ID.',
      needsApproval,
      inputSchema: z.object({
        id: z.string().describe('Task ID to delete'),
        taskName: z.string().optional().describe('Task title (for display in confirmation UI — always include this)'),
      }),
      execute: async (args) => {
        const result = await deleteTask(userId, args.id);
        if (!result) return { error: 'Task not found' };
        if (result.gcalEventId) {
          const gcalEventId = result.gcalEventId;
          Promise.all([import('@/lib/gcal/events'), getWriteCalendarId(userId)])
            .then(([{ deleteEvent }, calId]) => deleteEvent(userId, calId, gcalEventId))
            .catch(() => {});
        }
        return { deleted: true, id: result.id, title: result.title };
      },
    }),

    completeTask: tool({
      description: 'Mark a task as done. Spawns the next occurrence for recurring tasks.',
      needsApproval,
      inputSchema: z.object({
        id: z.string().describe('Task ID to complete'),
        taskName: z.string().optional().describe('Task title (for display in confirmation UI — always include this)'),
      }),
      execute: async (args) => {
        const task = await getTask(userId, args.id);
        if (!task) return { error: 'Task not found' };
        if (task.status === 'done') return { id: task.id, title: task.title, status: 'done' as const, alreadyDone: true };

        const now = new Date();
        await db.update(tasks).set({ status: 'done', completedAt: now, updatedAt: now, gcalEventId: null })
          .where(and(eq(tasks.id, args.id), eq(tasks.userId, userId)));

        if (task.gcalEventId) {
          const gcalEventId = task.gcalEventId;
          Promise.all([import('@/lib/gcal/events'), getWriteCalendarId(userId)])
            .then(([{ deleteEvent }, calId]) => deleteEvent(userId, calId, gcalEventId))
            .catch(() => {});
        }

        if (task.recurrenceRule) {
          const newTaskId = await spawnNextOccurrence(userId, args.id, now);
          if (newTaskId) {
            await enqueueJob('schedule:single-task', {
              userId,
              payload: { taskId: newTaskId },
              idempotencyKey: `schedule:single-task:${newTaskId}:${Date.now()}`,
            });
          }
        }

        return { id: task.id, title: task.title, status: 'done' as const };
      },
    }),

    listTags: tool({
      description: 'List all tags for the current user.',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await listTags(userId);
        return result.map((t) => ({ id: t.id, name: t.name, color: t.color }));
      },
    }),

    createTag: tool({
      description: 'Create a new tag.',
      inputSchema: z.object({
        name: z.string().describe('Tag name'),
        color: z.string().optional().describe('Hex color for the tag'),
      }),
      execute: async (args) => {
        const tag = await createTag(userId, {
          name: args.name,
          color: args.color,
        });
        return { id: tag.id, name: tag.name, color: tag.color };
      },
    }),

    listSchedule: tool({
      description: 'Show currently scheduled tasks.',
      inputSchema: z.object({}),
      execute: async () => {
        const scheduled = await listTasks(userId, { status: 'scheduled' });
        return scheduled.map((t) => ({
          id: t.id,
          title: t.title,
          scheduledAt: t.scheduledAt,
          durationMins: t.durationMins,
          priority: t.priority,
          tags: t.tags.map((tag) => tag.name),
        }));
      },
    }),

    runSchedule: tool({
      description:
        'Trigger a full schedule optimisation run (runs in background).',
      inputSchema: z.object({}),
      execute: async () => {
        await enqueueJob('schedule:full-run', {
          userId,
          idempotencyKey: `full-run:${userId}:${Date.now()}`,
        });
        return { enqueued: true, message: 'Full schedule run enqueued.' };
      },
    }),

    bulkUpdateTasks: tool({
      description:
        'Update multiple tasks at once. Use this instead of calling updateTask repeatedly when the user wants to change several tasks simultaneously.',
      needsApproval,
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              id: z.string().describe('Task ID to update'),
              taskName: z.string().optional().describe('Current task title (for display in confirmation UI)'),
              title: z.string().optional(),
              description: z.string().optional(),
              durationMins: z.number().int().positive().optional(),
              priority: z.number().int().min(1).max(4).optional(),
              schedulable: z.boolean().optional(),
              bufferMins: z.number().int().min(0).optional(),
              isSplittable: z.boolean().optional(),
              tags: z.array(z.string()).optional().describe('Tag names to set'),
              deadline: z.string().nullable().optional(),
              status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled']).optional(),
            }),
          )
          .min(1)
          .max(25)
          .describe('Array of task updates to apply'),
      }),
      execute: async (args) => {
        const results = await Promise.all(
          args.updates.map(async ({ id, tags: tagNames, taskName: _taskName, ...rest }) => {
            const tagIds = tagNames ? await resolveTagNames(userId, tagNames) : undefined;
            const task = await updateTask(userId, id, { ...rest, tagIds });
            if (!task) return { id, error: 'Task not found' };
            return { id: task.id, title: task.title, status: task.status };
          }),
        );
        const succeeded = results.filter((r) => !('error' in r)).length;
        const failed = results.filter((r) => 'error' in r).length;
        return { updated: succeeded, failed, results };
      },
    }),
  };
}
