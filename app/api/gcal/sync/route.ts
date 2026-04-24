// app/api/gcal/sync/route.ts
// Two-phase sync:
//   1. Pull: fetch live free/busy from GCal → write to DB cache (used by scheduler)
//   2. Push: write all scheduled tasks as GCal events (the only place events are written)
//
// The scheduler (drain + /api/schedule/run) never touches GCal directly.
import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { googleAccounts, googleCalendars, tasks } from '@/lib/db/schema';
import { getFreeBusy } from '@/lib/gcal/freebusy';
import { upsertEvent, deleteEvent } from '@/lib/gcal/events';
import { getWriteCalendarId } from '@/lib/gcal/calendars';
import { writeBusyCache, getBusyCacheAge } from '@/lib/gcal/busy-cache';

const LOOKAHEAD_DAYS = 14;

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const updatedAt = await getBusyCacheAge(userId);
  return NextResponse.json({ updatedAt: updatedAt?.toISOString() ?? null });
}

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const [acct] = await db
    .select({ id: googleAccounts.id })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));

  if (!acct) {
    return NextResponse.json({ error: 'No Google account connected' }, { status: 400 });
  }

  // ── Phase 1: Pull free/busy → cache ─────────────────────────────────────────

  const calRows = await db
    .select({ calendarId: googleCalendars.calendarId })
    .from(googleCalendars)
    .where(and(
      eq(googleCalendars.userId, userId),
      eq(googleCalendars.selected, true),
      eq(googleCalendars.showAsBusy, true),
    ));

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + LOOKAHEAD_DAYS);

  let intervalCount = 0;
  if (calRows.length > 0) {
    const intervals = await getFreeBusy(userId, calRows.map((r) => r.calendarId), from, to);
    await writeBusyCache(userId, intervals);
    intervalCount = intervals.length;
  } else {
    await writeBusyCache(userId, []);
  }

  // ── Phase 2: Push scheduled tasks → GCal events ─────────────────────────────

  const writeCalId = await getWriteCalendarId(userId).catch(() => null);
  if (!writeCalId) {
    const updatedAt = await getBusyCacheAge(userId);
    return NextResponse.json({ intervalCount, eventsWritten: 0, updatedAt: updatedAt?.toISOString() ?? null });
  }

  // Fetch all tasks: scheduled ones get upserted; others with a gcalEventId get cleaned up.
  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      scheduledAt: tasks.scheduledAt,
      scheduledEnd: tasks.scheduledEnd,
      gcalEventId: tasks.gcalEventId,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId));

  const scheduledTasks = allTasks.filter((t) => t.status === 'scheduled' && t.scheduledAt && t.scheduledEnd);
  const staleEventIds = allTasks
    .filter((t) => t.gcalEventId && t.status !== 'scheduled')
    .map((t) => ({ id: t.id, gcalEventId: t.gcalEventId! }));

  // Delete stale events (tasks no longer scheduled)
  await Promise.allSettled(
    staleEventIds.map((t) => deleteEvent(userId, writeCalId, t.gcalEventId)),
  );
  if (staleEventIds.length > 0) {
    await db
      .update(tasks)
      .set({ gcalEventId: null })
      .where(and(
        eq(tasks.userId, userId),
        inArray(tasks.id, staleEventIds.map((t) => t.id)),
      ));
  }

  // Upsert events for scheduled tasks
  const gcalWrites = await Promise.allSettled(
    scheduledTasks.map((t) =>
      upsertEvent(
        userId,
        writeCalId,
        { id: t.id, title: t.title, description: t.description } as Parameters<typeof upsertEvent>[2],
        { start: t.scheduledAt!, end: t.scheduledEnd!, chunkIndex: 0 },
        t.gcalEventId ?? null,
      ).then((gcalEventId) => ({ taskId: t.id, gcalEventId })),
    ),
  );

  // Write back gcalEventId for successfully upserted tasks
  const succeeded = gcalWrites
    .filter((r): r is PromiseFulfilledResult<{ taskId: string; gcalEventId: string }> => r.status === 'fulfilled')
    .map((r) => r.value);

  await Promise.all(
    succeeded.map(({ taskId, gcalEventId }) =>
      db
        .update(tasks)
        .set({ gcalEventId })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))),
    ),
  );

  const updatedAt = await getBusyCacheAge(userId);
  return NextResponse.json({
    intervalCount,
    eventsWritten: succeeded.length,
    updatedAt: updatedAt?.toISOString() ?? null,
  });
}
