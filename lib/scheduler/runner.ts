// lib/scheduler/runner.ts
// Orchestrator — the ONLY scheduler file that reads from the DB or calls GCal.
// Business logic lives in the pure modules; this file only wires them together.

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tasks, scheduleWindows, blackoutBlocks, windowTemplates, scheduleLogs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import type { Task, PlacedChunk, BusyInterval, BlackoutBlock, RecurrenceRule, WindowTemplate } from './types';
import { selectCandidates, buildDoneSet } from './candidates';
import { computeFreeSlots, consumeSlot } from './slots';
import { placeTask, placementConsumedRange, rankSlotsForTask } from './placement';
import { splitTask } from './splitting';

// ── GCal adapter interface ────────────────────────────────────────────────────
// Injected by callers that have GCal credentials. When omitted, GCal steps
// are skipped (busy intervals are empty, event write is a no-op).
// lib/gcal/ will provide the real implementation — see next session.

export type GCalAdapter = {
  getFreeBusy(
    calendarIds: string[],
    start: Date,
    end: Date,
  ): Promise<BusyInterval[]>;

  upsertEvent(
    calendarId: string,
    task: Task,
    chunk: PlacedChunk,
    existingEventId?: string | null,
  ): Promise<string>; // returns gcalEventId
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOOKAHEAD_DAYS = 14;

function lookaheadRange(now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  const to = new Date(now);
  to.setDate(to.getDate() + LOOKAHEAD_DAYS);
  return { from, to };
}

async function loadContext(userId: string) {
  const [userTasks, windows, blackouts, templates] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(scheduleWindows).where(eq(scheduleWindows.userId, userId)),
    db.select().from(blackoutBlocks).where(eq(blackoutBlocks.userId, userId)),
    db.select().from(windowTemplates).where(eq(windowTemplates.userId, userId)),
  ]);
  return { userTasks, windows, blackouts, templates };
}

type LoadedContext = Awaited<ReturnType<typeof loadContext>>;

function mapWindows(windows: LoadedContext['windows']) {
  return windows.map((w) => ({
    dayOfWeek: w.dayOfWeek,
    startTime: w.startTime,
    endTime: w.endTime,
    templateId: w.templateId,
  }));
}

function mapBlackouts(blackouts: LoadedContext['blackouts']): BlackoutBlock[] {
  return blackouts.map((b) => ({
    startAt: b.startAt,
    endAt: b.endAt,
    recurrenceRule: b.recurrenceRule as RecurrenceRule | null,
  }));
}

function mapTemplates(templates: LoadedContext['templates']): WindowTemplate[] {
  return templates.map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault }));
}

// ── scheduleSingleTask ────────────────────────────────────────────────────────

/**
 * Places one task into the next available slot.
 * Called on task create/update (schedule-on-write, ADR-005).
 *
 * Returns the placed chunk or null if no slot was found within the lookahead.
 */
export async function scheduleSingleTask(
  userId: string,
  taskId: string,
  gcal?: GCalAdapter,
): Promise<PlacedChunk | null> {
  const start = Date.now();
  const now = new Date();
  const { from, to } = lookaheadRange(now);

  const { userTasks, windows, blackouts, templates } = await loadContext(userId);
  const target = userTasks.find((t) => t.id === taskId);

  if (!target || !target.schedulable) return null;
  if (target.timeLocked) return null; // don't move a user-locked task
  if (target.status === 'done' || target.status === 'cancelled') return null;

  // Check dependency satisfaction
  const doneSet = buildDoneSet(userTasks);
  if (target.dependsOn.some((depId) => !doneSet.has(depId))) return null;

  // Fetch busy intervals (or empty if GCal not available)
  // Also treat other users' locked tasks as busy so we don't schedule into their time
  const lockedBusy: BusyInterval[] = userTasks
    .filter((t) => t.timeLocked && t.scheduledAt && t.scheduledEnd && t.id !== taskId)
    .map((t) => ({ start: t.scheduledAt!, end: t.scheduledEnd! }));

  const busy: BusyInterval[] = [
    ...(gcal ? await gcal.getFreeBusy([], from, to) : []),
    ...lockedBusy,
  ];

  const scored = { ...target, urgency: 0 }; // urgency is irrelevant for single placement
  const freeSlots = computeFreeSlots(
    mapWindows(windows),
    mapBlackouts(blackouts),
    busy,
    from,
    to,
  );

  const rankedSlots = rankSlotsForTask(freeSlots, scored, mapTemplates(templates));
  let placed: PlacedChunk | null = placeTask(scored, rankedSlots);

  if (!placed && scored.isSplittable) {
    const chunks = splitTask(scored, rankedSlots);
    // For single-task placement, use only the first chunk; remainder enqueued as follow-up
    placed = chunks?.[0] ?? null;
  }

  const durationMs = Date.now() - start;

  if (placed) {
    let gcalEventId: string | null = target.gcalEventId ?? null;
    if (gcal) {
      gcalEventId = await gcal.upsertEvent('primary', target, placed, gcalEventId);
    }

    await db
      .update(tasks)
      .set({
        status: 'scheduled',
        scheduledAt: placed.start,
        scheduledEnd: placed.end,
        gcalEventId: gcalEventId ?? undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  }

  await db.insert(scheduleLogs).values({
    id: newId(),
    userId,
    runType: 'single-task',
    taskId,
    status: placed ? 'success' : 'partial',
    tasksScheduled: placed ? 1 : 0,
    durationMs,
  });

  return placed;
}

// ── scheduleFullRunChunk ──────────────────────────────────────────────────────

const CHUNK_SIZE = 20; // tasks per cron invocation

/**
 * Schedules up to CHUNK_SIZE pending tasks for the user.
 * Each invocation must complete in <10s (Vercel Hobby limit).
 * Returns how many tasks were scheduled and how many remain.
 */
export async function scheduleFullRunChunk(
  userId: string,
  gcal?: GCalAdapter,
): Promise<{ scheduled: number; remaining: number }> {
  const start = Date.now();
  const now = new Date();
  const { from, to } = lookaheadRange(now);

  const { userTasks: rawTasks, windows, blackouts, templates } = await loadContext(userId);

  // Unlock tasks whose locked time has passed so the auto-scheduler can reclaim them
  const pastLockedIds = rawTasks
    .filter((t) => t.timeLocked && t.scheduledAt && t.scheduledAt < now)
    .map((t) => t.id);

  if (pastLockedIds.length > 0) {
    await db
      .update(tasks)
      .set({ timeLocked: false, scheduledAt: null, scheduledEnd: null, status: 'pending', updatedAt: now })
      .where(inArray(tasks.id, pastLockedIds));
  }

  // Reflect unlocks in the working copy so candidates picks them up
  const userTasks = rawTasks.map((t) =>
    pastLockedIds.includes(t.id)
      ? { ...t, timeLocked: false, scheduledAt: null, scheduledEnd: null, status: 'pending' as const }
      : t,
  );

  const doneSet = buildDoneSet(userTasks);
  const candidates = selectCandidates(userTasks, doneSet, now).slice(0, CHUNK_SIZE);

  // Treat still-locked tasks as busy so free-slot computation respects them
  const lockedBusy: BusyInterval[] = userTasks
    .filter((t) => t.timeLocked && t.scheduledAt && t.scheduledEnd)
    .map((t) => ({ start: t.scheduledAt!, end: t.scheduledEnd! }));

  const busy: BusyInterval[] = [
    ...(gcal ? await gcal.getFreeBusy([], from, to) : []),
    ...lockedBusy,
  ];

  let freeSlots = computeFreeSlots(
    mapWindows(windows),
    mapBlackouts(blackouts),
    busy,
    from,
    to,
  );

  const tmpl = mapTemplates(templates);

  const scheduledIds: string[] = [];
  const gcalUpdates: Array<{ id: string; gcalEventId: string | null; start: Date; end: Date }> = [];

  for (const task of candidates) {
    const rankedSlots = rankSlotsForTask(freeSlots, task, tmpl);
    let placed: PlacedChunk | null = placeTask(task, rankedSlots);

    if (!placed && task.isSplittable) {
      const chunks = splitTask(task, rankedSlots);
      placed = chunks?.[0] ?? null;
    }

    if (!placed) continue;

    let gcalEventId: string | null = task.gcalEventId ?? null;
    if (gcal) {
      gcalEventId = await gcal.upsertEvent('primary', task, placed, gcalEventId);
    }

    const consumed = placementConsumedRange(task, placed);
    freeSlots = consumeSlot(freeSlots, consumed);

    scheduledIds.push(task.id);
    gcalUpdates.push({ id: task.id, gcalEventId, start: placed.start, end: placed.end });
  }

  if (scheduledIds.length > 0) {
    // Batch-update scheduled tasks
    await Promise.all(
      gcalUpdates.map(({ id, gcalEventId, start, end }) =>
        db
          .update(tasks)
          .set({
            status: 'scheduled',
            scheduledAt: start,
            scheduledEnd: end,
            gcalEventId: gcalEventId ?? undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.id, id), eq(tasks.userId, userId))),
      ),
    );
  }

  const remaining = candidates.length - scheduledIds.length;
  const durationMs = Date.now() - start;

  await db.insert(scheduleLogs).values({
    id: newId(),
    userId,
    runType: 'full-run',
    status: remaining === 0 ? 'success' : 'partial',
    tasksScheduled: scheduledIds.length,
    durationMs,
  });

  return { scheduled: scheduledIds.length, remaining };
}
