// lib/services/tasks.ts
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { taskTags, tags, tasks } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskWithTags = typeof tasks.$inferSelect & {
  tags: { id: string; name: string; color: string | null }[];
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  durationMins?: number;
  deadline?: string; // ISO 8601 string
  priority: number;
  schedulable: boolean;
  bufferMins: number;
  minChunkMins?: number;
  isSplittable: boolean;
  dependsOn: string[];
  recurrenceRule?: Record<string, unknown>;
  tagIds: string[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  durationMins?: number;
  deadline?: string | null;
  priority?: number;
  status?: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';
  schedulable?: boolean;
  bufferMins?: number;
  minChunkMins?: number | null;
  isSplittable?: boolean;
  dependsOn?: string[];
  recurrenceRule?: Record<string, unknown> | null;
  tagIds?: string[];
};

export type ListTasksFilters = {
  status?: string;
  priority?: number;
  tagId?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function attachTags(
  rows: (typeof tasks.$inferSelect)[],
): Promise<TaskWithTags[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((t) => t.id);
  const tagRows = await db
    .select({
      taskId: taskTags.taskId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, ids));

  const byTask = new Map<string, { id: string; name: string; color: string | null }[]>();
  for (const r of tagRows) {
    const list = byTask.get(r.taskId) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color });
    byTask.set(r.taskId, list);
  }
  return rows.map((t) => ({ ...t, tags: byTask.get(t.id) ?? [] }));
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function listTasks(
  userId: string,
  filters: ListTasksFilters = {},
): Promise<TaskWithTags[]> {
  const conditions = [eq(tasks.userId, userId)];
  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status as typeof tasks.$inferSelect['status']));
  }
  if (filters.priority !== undefined) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  let rows = await db
    .select()
    .from(tasks)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));

  if (filters.tagId) {
    const linked = await db
      .select({ taskId: taskTags.taskId })
      .from(taskTags)
      .where(eq(taskTags.tagId, filters.tagId));
    const linkedIds = new Set(linked.map((r) => r.taskId));
    rows = rows.filter((t) => linkedIds.has(t.id));
  }

  return attachTags(rows);
}

export async function getTask(
  userId: string,
  id: string,
): Promise<TaskWithTags | null> {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (!row) return null;
  const [withTags] = await attachTags([row]);
  return withTags ?? null;
}

export async function createTask(
  userId: string,
  input: CreateTaskInput,
): Promise<TaskWithTags> {
  const { tagIds, deadline, recurrenceRule, ...rest } = input;
  const id = newId();
  await db.insert(tasks).values({
    id,
    userId,
    ...rest,
    deadline: deadline ? new Date(deadline) : undefined,
    recurrenceRule: recurrenceRule ?? undefined,
    updatedAt: new Date(),
  });
  if (tagIds.length > 0) {
    await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: id, tagId })));
  }
  return (await getTask(userId, id))!;
}

export async function updateTask(
  userId: string,
  id: string,
  input: UpdateTaskInput,
): Promise<TaskWithTags | null> {
  const { tagIds, deadline, recurrenceRule, ...rest } = input;

  const patch: Partial<typeof tasks.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (deadline !== undefined) {
    patch.deadline = deadline ? new Date(deadline) : null;
  }
  if (recurrenceRule !== undefined) {
    patch.recurrenceRule = recurrenceRule ?? null;
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  if (!updated) return null;

  if (tagIds !== undefined) {
    await db.delete(taskTags).where(eq(taskTags.taskId, id));
    if (tagIds.length > 0) {
      await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: id, tagId })));
    }
  }
  return getTask(userId, id);
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return !!deleted;
}
