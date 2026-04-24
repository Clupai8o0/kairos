// app/api/gcal/sync/route.ts
// Two-phase sync streamed as NDJSON:
//   Pull: fetch live free/busy → DB cache  (scheduler reads from here)
//   Push: upsert GCal events for all scheduled tasks  (only place events are written)
//
// On rate-limit: exponential backoff per task (2s → 4s → 8s), up to 3 retries.
// Progress events streamed to client so Sonner can update the toast in place.
import { and, eq, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { googleAccounts, googleCalendars, tasks } from '@/lib/db/schema';
import { getFreeBusy } from '@/lib/gcal/freebusy';
import { upsertEvent, deleteEvent } from '@/lib/gcal/events';
import { getWriteCalendarId } from '@/lib/gcal/calendars';
import { writeBusyCache, getBusyCacheAge } from '@/lib/gcal/busy-cache';
import { GCalRateLimitError } from '@/lib/gcal/errors';

const LOOKAHEAD_DAYS = 14;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

const enc = new TextEncoder();
function send(controller: ReadableStreamDefaultController, event: object) {
  controller.enqueue(enc.encode(JSON.stringify(event) + '\n'));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withBackoff<T>(
  fn: () => Promise<T>,
  controller: ReadableStreamDefaultController,
  done: number,
  total: number,
): Promise<T | null> {
  let delay = INITIAL_BACKOFF_MS;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GCalRateLimitError && attempt < MAX_RETRIES - 1) {
        send(controller, { type: 'ratelimit', retryIn: delay, done, total });
        await sleep(delay);
        delay *= 2;
      } else {
        return null;
      }
    }
  }
  return null;
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const updatedAt = await getBusyCacheAge(userId);
  return Response.json({ updatedAt: updatedAt?.toISOString() ?? null });
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
    return Response.json({ error: 'No Google account connected' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Phase 1: Pull free/busy → cache ───────────────────────────────────
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

        send(controller, { type: 'pull', intervalCount });

        // ── Phase 2: Push scheduled tasks → GCal events ───────────────────────
        const writeCalId = await getWriteCalendarId(userId).catch(() => null);
        if (!writeCalId) {
          const updatedAt = await getBusyCacheAge(userId);
          send(controller, { type: 'complete', eventsWritten: 0, intervalCount, updatedAt: updatedAt?.toISOString() ?? null });
          controller.close();
          return;
        }

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

        const scheduledTasks = allTasks.filter(
          (t) => t.status === 'scheduled' && t.scheduledAt && t.scheduledEnd,
        );
        const staleTasks = allTasks.filter(
          (t) => t.gcalEventId && t.status !== 'scheduled',
        );

        send(controller, { type: 'start', total: scheduledTasks.length });

        // Delete stale events (swallow individual errors)
        await Promise.allSettled(
          staleTasks.map((t) => deleteEvent(userId, writeCalId, t.gcalEventId!)),
        );
        if (staleTasks.length > 0) {
          await db
            .update(tasks)
            .set({ gcalEventId: null })
            .where(and(
              eq(tasks.userId, userId),
              inArray(tasks.id, staleTasks.map((t) => t.id)),
            ));
        }

        // Upsert events one at a time with backoff on rate limit
        let eventsWritten = 0;
        for (const task of scheduledTasks) {
          const gcalEventId = await withBackoff(
            () => upsertEvent(
              userId,
              writeCalId,
              { id: task.id, title: task.title, description: task.description } as Parameters<typeof upsertEvent>[2],
              { start: task.scheduledAt!, end: task.scheduledEnd!, chunkIndex: 0 },
              task.gcalEventId ?? null,
            ),
            controller,
            eventsWritten,
            scheduledTasks.length,
          );

          if (gcalEventId) {
            await db
              .update(tasks)
              .set({ gcalEventId })
              .where(and(eq(tasks.id, task.id), eq(tasks.userId, userId)));
            eventsWritten++;
          }

          send(controller, { type: 'progress', done: eventsWritten, total: scheduledTasks.length });
        }

        const updatedAt = await getBusyCacheAge(userId);
        send(controller, {
          type: 'complete',
          eventsWritten,
          intervalCount,
          updatedAt: updatedAt?.toISOString() ?? null,
        });
        controller.close();
      } catch (e) {
        send(controller, { type: 'error', message: (e as Error)?.message ?? 'Sync failed' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
