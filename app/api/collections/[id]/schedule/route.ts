// app/api/collections/[id]/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getSchedulableTaskIds } from '@/lib/services/collections';
import { enqueueJob } from '@/lib/services/jobs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const taskIds = await getSchedulableTaskIds(userId, id);
  if (taskIds.length === 0) {
    return NextResponse.json({ enqueued: false, message: 'No schedulable tasks in this collection' });
  }

  await enqueueJob('schedule:full-run', {
    userId,
    payload: { collectionId: id },
    idempotencyKey: `schedule:collection:${id}:${Date.now()}`,
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  fetch(new URL('/api/cron/drain', baseUrl).toString(), { method: 'POST' }).catch(() => {});

  return NextResponse.json({ enqueued: true, taskCount: taskIds.length });
}
