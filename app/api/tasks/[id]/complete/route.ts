// app/api/tasks/[id]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getTask } from '@/lib/services/tasks';
import { spawnNextOccurrence } from '@/lib/services/recurrence';
import { enqueueJob } from '@/lib/services/jobs';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

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

  const now = new Date();

  // Mark the task as done with direct DB update
  await db.update(tasks).set({ 
    status: 'done', 
    completedAt: now, 
    updatedAt: now 
  })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

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