// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { getTask, updateTask } from '@/lib/services/tasks';
import { deleteInstance, deleteSeries } from '@/lib/services/recurrence';
import { enqueueJob } from '@/lib/services/jobs';

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  durationMins: z.number().int().positive().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled']).optional(),
  schedulable: z.boolean().optional(),
  timeLocked: z.boolean().optional(),
  bufferMins: z.number().int().min(0).optional(),
  minChunkMins: z.number().int().positive().nullable().optional(),
  isSplittable: z.boolean().optional(),
  dependsOn: z.array(z.string()).optional(),
  recurrenceRule: z.record(z.string(), z.unknown()).nullable().optional(),
  preferredTemplateId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  scheduledEnd: z.string().datetime({ offset: true }).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const task = await getTask(userId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const task = await updateTask(userId, id, parsed.data);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Re-schedule logic: manual placement vs auto-schedule
  const isManualPlacement = 'scheduledAt' in parsed.data && parsed.data.scheduledAt !== null;
  if (isManualPlacement) {
    // Manual placement — reschedule others around this locked task
    await enqueueJob('schedule:full-run', {
      userId,
      payload: {},
      idempotencyKey: `schedule:full-run:${userId}:${Date.now()}`,
    });
    fetch(
      new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
      { method: 'POST' },
    ).catch(() => {});
  } else {
    // Auto-schedule if scheduling-related fields changed
    const scheduleFields: (keyof typeof parsed.data)[] = [
      'durationMins', 'deadline', 'priority', 'schedulable', 'bufferMins', 'isSplittable', 'dependsOn', 'preferredTemplateId',
    ];
    const touchesSchedule = scheduleFields.some((f) => f in parsed.data);
    if (touchesSchedule && parsed.data.schedulable !== false) {
      await enqueueJob('schedule:single-task', {
        userId,
        payload: { taskId: id },
        idempotencyKey: `schedule:single-task:${id}:${Date.now()}`,
      });
      fetch(
        new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
        { method: 'POST' },
      ).catch(() => {});
    }
  }

  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  
  // Read scope from query params, default to 'instance'
  const scope = req.nextUrl.searchParams.get('scope') ?? 'instance';
  
  // Validate scope parameter
  if (scope !== 'instance' && scope !== 'series') {
    return NextResponse.json({ error: 'Invalid scope. Must be "instance" or "series"' }, { status: 400 });
  }

  if (scope === 'instance') {
    // Delete single instance
    const deleted = await deleteInstance(userId, id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fire-and-forget: remove the associated GCal event if one exists
    if (deleted.gcalEventId) {
      const gcalEventId = deleted.gcalEventId;
      import('@/lib/gcal/events')
        .then(({ deleteEvent }) => deleteEvent(userId, 'primary', gcalEventId))
        .catch(() => {});
    }
  } else {
    // Delete entire series
    const result = await deleteSeries(userId, id);
    if (result.deletedIds.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fire-and-forget: remove all associated GCal events
    if (result.gcalEventIds.length > 0) {
      import('@/lib/gcal/events')
        .then(({ deleteEvent }) => {
          result.gcalEventIds.forEach(gcalEventId => 
            deleteEvent(userId, 'primary', gcalEventId).catch(() => {})
          );
        })
        .catch(() => {});
    }
  }

  return new NextResponse(null, { status: 204 });
}
