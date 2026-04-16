// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteTask, getTask, updateTask } from '@/lib/services/tasks';
import { enqueueJob } from '@/lib/services/jobs';

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  durationMins: z.number().int().positive().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled']).optional(),
  schedulable: z.boolean().optional(),
  bufferMins: z.number().int().min(0).optional(),
  minChunkMins: z.number().int().positive().nullable().optional(),
  isSplittable: z.boolean().optional(),
  dependsOn: z.array(z.string()).optional(),
  recurrenceRule: z.record(z.string(), z.unknown()).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
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

  // Re-schedule if scheduling-related fields changed
  const scheduleFields: (keyof typeof parsed.data)[] = [
    'durationMins', 'deadline', 'priority', 'schedulable', 'bufferMins', 'isSplittable', 'dependsOn',
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
    ).catch(() => {/* fire-and-forget */});
  }

  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteTask(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
