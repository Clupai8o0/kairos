// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createTask, listTasks } from '@/lib/services/tasks';
import { enqueueJob } from '@/lib/services/jobs';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  durationMins: z.number().int().positive().optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  priority: z.number().int().min(1).max(4).default(3),
  schedulable: z.boolean().default(true),
  timeLocked: z.boolean().default(false),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  scheduledEnd: z.string().datetime({ offset: true }).optional(),
  bufferMins: z.number().int().min(0).default(15),
  minChunkMins: z.number().int().positive().optional(),
  isSplittable: z.boolean().default(false),
  dependsOn: z.array(z.string()).default([]),
  recurrenceRule: z.record(z.string(), z.unknown()).optional(),
  preferredTemplateId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
});

const ListTasksSchema = z.object({
  status: z.enum(['pending', 'scheduled', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.coerce.number().int().min(1).max(4).optional(),
  tagId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const parsed = ListTasksSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await listTasks(userId, parsed.data);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const isLocked = parsed.data.timeLocked && !!parsed.data.scheduledAt;
  const task = await createTask(userId, {
    ...parsed.data,
    // If creating with a locked time, mark as scheduled immediately
    status: isLocked ? 'scheduled' : 'pending',
  });

  if (isLocked) {
    // Task is locked to a specific time — reschedule others around it
    await enqueueJob('schedule:full-run', {
      userId,
      payload: {},
      idempotencyKey: `schedule:full-run:${userId}:${Date.now()}`,
    });
    fetch(
      new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
      { method: 'POST' },
    ).catch(() => {/* fire-and-forget */});
  } else if (parsed.data.schedulable !== false) {
    await enqueueJob('schedule:single-task', {
      userId,
      payload: { taskId: task.id },
      idempotencyKey: `schedule:single-task:${task.id}`,
    });
    fetch(
      new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
      { method: 'POST' },
    ).catch(() => {/* fire-and-forget */});
  }

  return NextResponse.json(task, { status: 201 });
}
