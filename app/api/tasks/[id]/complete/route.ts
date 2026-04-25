// app/api/tasks/[id]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getTask } from '@/lib/services/tasks';
import { spawnNextOccurrence } from '@/lib/services/recurrence';
import { enqueueJob } from '@/lib/services/jobs';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { patchEvent } from '@/lib/gcal/events';
import { getWriteCalendarId } from '@/lib/gcal/calendars';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  // Check task exists and belongs to user
  const task = await getTask(userId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Idempotent: already done
  if (task.status === 'done') return NextResponse.json(task);

  // Gate: all prerequisite tasks must be done first
  if (task.dependsOn.length > 0) {
    const depTasks = await db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(and(inArray(tasks.id, task.dependsOn), eq(tasks.userId, userId)));
    const incomplete = depTasks.filter((d) => d.status !== 'done');
    if (incomplete.length > 0) {
      return NextResponse.json({
        error: `${incomplete.length} prerequisite task${incomplete.length > 1 ? 's' : ''} not yet done: ${incomplete.map((d) => d.title).join(', ')}`,
        blockedBy: incomplete.map((d) => ({ id: d.id, title: d.title })),
      }, { status: 409 });
    }
  }

  const now = new Date();

  // If the task is scheduled in the future, move its start back so the block ends at now
  const scheduledAt = task.scheduledAt ? new Date(task.scheduledAt) : null;
  const adjustedStart = scheduledAt && scheduledAt > now
    ? new Date(now.getTime() - (task.durationMins ?? 60) * 60 * 1000)
    : undefined;

  // Mark done, pin scheduledEnd to now
  await db.update(tasks).set({
    status: 'done',
    completedAt: now,
    scheduledEnd: now,
    ...(adjustedStart !== undefined ? { scheduledAt: adjustedStart } : {}),
    updatedAt: now,
  }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  // Patch the GCal event end (and start if shifted) — non-fatal
  if (task.gcalEventId) {
    try {
      const calendarId = await getWriteCalendarId(userId);
      await patchEvent(userId, calendarId, task.gcalEventId, {
        end: now.toISOString(),
        ...(adjustedStart !== undefined ? { start: adjustedStart.toISOString() } : {}),
      });
    } catch {
      // GCal patch is best-effort; don't fail the completion
    }
  }

  // If the task has a recurrenceRule, spawn the next occurrence
  if (task.recurrenceRule) {
    const newTaskId = await spawnNextOccurrence(userId, id, now);
    
    if (newTaskId) {
      // Enqueue a scheduling job for the new task
      await enqueueJob('schedule:single-task', {
        userId,
        payload: { taskId: newTaskId },
        idempotencyKey: `schedule:single-task:${newTaskId}:${Date.now()}`,
      });

      // Fire-and-forget trigger the drain endpoint
      fetch(
        new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
        { method: 'POST' },
      ).catch(() => {});
    }
  }

  // Return the updated task
  const updatedTask = await getTask(userId, id);
  return NextResponse.json(updatedTask);
}