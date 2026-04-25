// lib/services/collections.ts
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  collections,
  collectionPhases,
  collectionTasks,
  tasks,
  taskTags,
  tags,
} from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import type { Collection, CollectionPhase, CollectionTask } from '@/lib/db/schema/collections';

// ── Types ──────────────────────────────────────────────────────────────────

export type { Collection, CollectionPhase, CollectionTask };

export type TaskSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  durationMins: number | null;
  deadline: Date | null;
  scheduledAt: Date | null;
  tags: { id: string; name: string; color: string | null }[];
};

export type CollectionWithPhases = Collection & {
  phases: CollectionPhase[];
  taskCount: number;
  doneCount: number;
};

export type CollectionWithDetails = Collection & {
  phases: CollectionPhase[];
  tasks: (CollectionTask & { task: TaskSummary })[];
};

export type CreateCollectionInput = {
  title: string;
  description?: string;
  deadline?: string;
  color?: string;
};

export type UpdateCollectionInput = {
  title?: string;
  description?: string | null;
  deadline?: string | null;
  status?: 'active' | 'completed' | 'archived';
  color?: string | null;
};

export type CollectionProgress = {
  total: number;
  done: number;
  inProgress: number;
  scheduled: number;
  pending: number;
  backlog: number;
  blocked: number;
  cancelled: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function attachTagsToTasks(taskRows: (typeof tasks.$inferSelect)[]): Promise<TaskSummary[]> {
  if (taskRows.length === 0) return [];
  const ids = taskRows.map((t) => t.id);
  const tagRows = await db
    .select({ taskId: taskTags.taskId, id: tags.id, name: tags.name, color: tags.color })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, ids));

  const byTask = new Map<string, { id: string; name: string; color: string | null }[]>();
  for (const r of tagRows) {
    const list = byTask.get(r.taskId) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color });
    byTask.set(r.taskId, list);
  }
  return taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    durationMins: t.durationMins,
    deadline: t.deadline,
    scheduledAt: t.scheduledAt,
    dependsOn: t.dependsOn ?? [],
    tags: byTask.get(t.id) ?? [],
  }));
}

// ── Collections CRUD ───────────────────────────────────────────────────────

export async function listCollections(userId: string): Promise<CollectionWithPhases[]> {
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(asc(collections.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((c) => c.id);

  const [phaseRows, countRows] = await Promise.all([
    db
      .select()
      .from(collectionPhases)
      .where(inArray(collectionPhases.collectionId, ids))
      .orderBy(asc(collectionPhases.order)),
    db
      .select({
        collectionId: collectionTasks.collectionId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${tasks.status} in ('done', 'cancelled'))::int`,
      })
      .from(collectionTasks)
      .innerJoin(tasks, eq(tasks.id, collectionTasks.taskId))
      .where(inArray(collectionTasks.collectionId, ids))
      .groupBy(collectionTasks.collectionId),
  ]);

  const phasesByCollection = new Map<string, CollectionPhase[]>();
  for (const p of phaseRows) {
    const list = phasesByCollection.get(p.collectionId) ?? [];
    list.push(p);
    phasesByCollection.set(p.collectionId, list);
  }

  const countByCollection = new Map<string, { total: number; done: number }>();
  for (const c of countRows) {
    countByCollection.set(c.collectionId, { total: c.total, done: c.done });
  }

  return rows.map((c) => ({
    ...c,
    phases: phasesByCollection.get(c.id) ?? [],
    taskCount: countByCollection.get(c.id)?.total ?? 0,
    doneCount: countByCollection.get(c.id)?.done ?? 0,
  }));
}

export async function getCollectionDetails(
  userId: string,
  id: string,
): Promise<CollectionWithDetails | null> {
  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  if (!collection) return null;

  const [phaseRows, ctRows] = await Promise.all([
    db
      .select()
      .from(collectionPhases)
      .where(eq(collectionPhases.collectionId, id))
      .orderBy(asc(collectionPhases.order)),
    db
      .select({ ct: collectionTasks, task: tasks })
      .from(collectionTasks)
      .innerJoin(tasks, eq(tasks.id, collectionTasks.taskId))
      .where(eq(collectionTasks.collectionId, id))
      .orderBy(asc(collectionTasks.order)),
  ]);

  const taskSummaries = await attachTagsToTasks(ctRows.map((r) => r.task));
  const byTaskId = new Map(taskSummaries.map((t) => [t.id, t]));

  return {
    ...collection,
    phases: phaseRows,
    tasks: ctRows.map((r) => ({ ...r.ct, task: byTaskId.get(r.task.id)! })),
  };
}

export async function createCollection(
  userId: string,
  input: CreateCollectionInput,
): Promise<Collection> {
  const [row] = await db
    .insert(collections)
    .values({
      id: newId(),
      userId,
      title: input.title,
      description: input.description,
      deadline: input.deadline ? new Date(input.deadline) : null,
      color: input.color,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateCollection(
  userId: string,
  id: string,
  input: UpdateCollectionInput,
): Promise<Collection | null> {
  const set: Partial<typeof collections.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description;
  if (input.deadline !== undefined) set.deadline = input.deadline ? new Date(input.deadline) : null;
  if (input.status !== undefined) set.status = input.status;
  if (input.color !== undefined) set.color = input.color;

  const [row] = await db
    .update(collections)
    .set(set)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteCollection(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .returning({ id: collections.id });
  return !!deleted;
}

// ── Phase CRUD ─────────────────────────────────────────────────────────────

export async function createPhase(
  userId: string,
  collectionId: string,
  input: { title: string; order?: number },
): Promise<CollectionPhase | null> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return null;

  const [maxRow] = await db
    .select({ m: max(collectionPhases.order) })
    .from(collectionPhases)
    .where(eq(collectionPhases.collectionId, collectionId));

  const order = input.order ?? (maxRow?.m ?? -1) + 1;

  const [row] = await db
    .insert(collectionPhases)
    .values({ id: newId(), collectionId, title: input.title, order })
    .returning();
  return row;
}

export async function updatePhase(
  userId: string,
  collectionId: string,
  phaseId: string,
  input: { title?: string; order?: number },
): Promise<CollectionPhase | null> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return null;

  const [row] = await db
    .update(collectionPhases)
    .set(input)
    .where(
      and(eq(collectionPhases.id, phaseId), eq(collectionPhases.collectionId, collectionId)),
    )
    .returning();
  return row ?? null;
}

export async function deletePhase(
  userId: string,
  collectionId: string,
  phaseId: string,
): Promise<boolean> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return false;

  const [deleted] = await db
    .delete(collectionPhases)
    .where(
      and(eq(collectionPhases.id, phaseId), eq(collectionPhases.collectionId, collectionId)),
    )
    .returning({ id: collectionPhases.id });
  return !!deleted;
}

// ── Collection–Task membership ─────────────────────────────────────────────

export async function addTaskToCollection(
  userId: string,
  collectionId: string,
  taskId: string,
  opts?: { phaseId?: string },
): Promise<CollectionTask | null> {
  const [[col], [task]] = await Promise.all([
    db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId))),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))),
  ]);
  if (!col || !task) return null;

  const [maxRow] = await db
    .select({ m: max(collectionTasks.order) })
    .from(collectionTasks)
    .where(eq(collectionTasks.collectionId, collectionId));

  const order = (maxRow?.m ?? -1) + 1;

  const [row] = await db
    .insert(collectionTasks)
    .values({ collectionId, taskId, phaseId: opts?.phaseId ?? null, order })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function addTasksToCollectionBulk(
  userId: string,
  collectionId: string,
  entries: { taskId: string; phaseId?: string }[],
): Promise<{ added: number; skipped: number; invalid: number }> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return { added: 0, skipped: 0, invalid: entries.length };

  const requestedIds = entries.map((e) => e.taskId);
  const validRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, requestedIds)));
  const validSet = new Set(validRows.map((r) => r.id));
  const invalid = requestedIds.filter((id) => !validSet.has(id)).length;

  const validEntries = entries.filter((e) => validSet.has(e.taskId));
  if (validEntries.length === 0) return { added: 0, skipped: 0, invalid };

  const [maxRow] = await db
    .select({ m: max(collectionTasks.order) })
    .from(collectionTasks)
    .where(eq(collectionTasks.collectionId, collectionId));
  let order = (maxRow?.m ?? -1) + 1;

  const rows = await db
    .insert(collectionTasks)
    .values(
      validEntries.map((e) => ({
        collectionId,
        taskId: e.taskId,
        phaseId: e.phaseId ?? null,
        order: order++,
      })),
    )
    .onConflictDoNothing()
    .returning();

  const added = rows.length;
  const skipped = validEntries.length - added;
  return { added, skipped, invalid };
}

export async function removeTaskFromCollection(
  userId: string,
  collectionId: string,
  taskId: string,
): Promise<boolean> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return false;

  const [deleted] = await db
    .delete(collectionTasks)
    .where(
      and(
        eq(collectionTasks.collectionId, collectionId),
        eq(collectionTasks.taskId, taskId),
      ),
    )
    .returning({ collectionId: collectionTasks.collectionId });
  return !!deleted;
}

export async function updateCollectionTask(
  userId: string,
  collectionId: string,
  taskId: string,
  opts: { phaseId?: string | null; order?: number },
): Promise<CollectionTask | null> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return null;

  const [row] = await db
    .update(collectionTasks)
    .set(opts)
    .where(
      and(
        eq(collectionTasks.collectionId, collectionId),
        eq(collectionTasks.taskId, taskId),
      ),
    )
    .returning();
  return row ?? null;
}

// ── Progress ───────────────────────────────────────────────────────────────

export async function getCollectionProgress(
  userId: string,
  id: string,
): Promise<CollectionProgress | null> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  if (!col) return null;

  const rows = await db
    .select({ status: tasks.status })
    .from(collectionTasks)
    .innerJoin(tasks, eq(tasks.id, collectionTasks.taskId))
    .where(eq(collectionTasks.collectionId, id));

  const counts: CollectionProgress = {
    total: rows.length,
    done: 0,
    inProgress: 0,
    scheduled: 0,
    pending: 0,
    backlog: 0,
    blocked: 0,
    cancelled: 0,
  };
  for (const r of rows) {
    switch (r.status) {
      case 'done': counts.done++; break;
      case 'in_progress': counts.inProgress++; break;
      case 'scheduled': counts.scheduled++; break;
      case 'pending': counts.pending++; break;
      case 'backlog': counts.backlog++; break;
      case 'blocked': counts.blocked++; break;
      case 'cancelled': counts.cancelled++; break;
    }
  }
  return counts;
}

// ── Bulk schedule ──────────────────────────────────────────────────────────

export async function getSchedulableTaskIds(userId: string, collectionId: string): Promise<string[]> {
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  if (!col) return [];

  const rows = await db
    .select({ id: tasks.id })
    .from(collectionTasks)
    .innerJoin(tasks, eq(tasks.id, collectionTasks.taskId))
    .where(
      and(
        eq(collectionTasks.collectionId, collectionId),
        eq(tasks.schedulable, true),
      ),
    );
  return rows.map((r) => r.id);
}
