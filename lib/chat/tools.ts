// lib/chat/tools.ts — Core tool catalogue for chat surface
import { tool } from 'ai';
import { z } from 'zod';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  getTask,
} from '@/lib/services/tasks';
import { listTags, createTag } from '@/lib/services/tags';
import { enqueueJob } from '@/lib/services/jobs';
import { spawnNextOccurrence } from '@/lib/services/recurrence';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export function createCoreTools(userId: string) {
  return {
    listTasks: tool({
      description: 'List tasks, optionally filtered by status or tag.',
      inputSchema: z.object({
        status: z
          .enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled'])
          .optional()
          .describe('Filter by task status'),
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
      inputSchema: z.object({
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        durationMins: z.number().int().positive().optional().describe('Duration in minutes'),
        priority: z.number().int().min(1).max(4).default(3).describe('Priority 1 (highest) to 4 (lowest)'),
        schedulable: z.boolean().default(true).describe('Whether the task can be auto-scheduled'),
        bufferMins: z.number().int().min(0).default(15).describe('Buffer minutes after the task'),
        isSplittable: z.boolean().default(false).describe('Whether the task can be split into chunks'),
        tagIds: z.array(z.string()).default([]).describe('Tag IDs to attach'),
        deadline: z.string().optional().describe('ISO 8601 deadline'),
      }),
      execute: async (args) => {
        const task = await createTask(userId, {
          title: args.title,
          description: args.description,
          durationMins: args.durationMins,
          priority: args.priority,
          schedulable: args.schedulable,
          bufferMins: args.bufferMins,
          isSplittable: args.isSplittable,
          tagIds: args.tagIds,
          deadline: args.deadline,
          dependsOn: [],
        });

        if (task.schedulable) {
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
        };
      },
    }),

    updateTask: tool({
      description: 'Update an existing task by ID.',
      inputSchema: z.object({
        id: z.string().describe('Task ID to update'),
        title: z.string().optional(),
        description: z.string().optional(),
        durationMins: z.number().int().positive().optional(),
        priority: z.number().int().min(1).max(4).optional(),
        schedulable: z.boolean().optional(),
        bufferMins: z.number().int().min(0).optional(),
        isSplittable: z.boolean().optional(),
        tagIds: z.array(z.string()).optional(),
        deadline: z.string().nullable().optional(),
        status: z
          .enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled'])
          .optional(),
      }),
      execute: async (args) => {
        const { id, ...input } = args;
        const task = await updateTask(userId, id, input);
        if (!task) return { error: 'Task not found' };
        return { id: task.id, title: task.title, status: task.status };
      },
    }),

    deleteTask: tool({
      description: 'Delete a task by ID.',
      inputSchema: z.object({
        id: z.string().describe('Task ID to delete'),
      }),
      execute: async (args) => {
        const result = await deleteTask(userId, args.id);
        if (!result) return { error: 'Task not found' };
        return { deleted: true, id: result.id };
      },
    }),

    completeTask: tool({
      description: 'Mark a task as done. Spawns the next occurrence for recurring tasks.',
      inputSchema: z.object({
        id: z.string().describe('Task ID to complete'),
      }),
      execute: async (args) => {
        const task = await getTask(userId, args.id);
        if (!task) return { error: 'Task not found' };
        if (task.status === 'done') return { id: task.id, title: task.title, status: 'done' as const, alreadyDone: true };

        const now = new Date();
        await db.update(tasks).set({ status: 'done', completedAt: now, updatedAt: now })
          .where(and(eq(tasks.id, args.id), eq(tasks.userId, userId)));

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
  };
}
