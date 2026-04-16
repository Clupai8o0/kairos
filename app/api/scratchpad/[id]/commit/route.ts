// app/api/scratchpad/[id]/commit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { commitScratchpad } from '@/lib/services/scratchpad';
import { enqueueJob } from '@/lib/services/jobs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { taskIds } = await commitScratchpad(userId, id);

  // Enqueue placement for each task
  await Promise.all(
    taskIds.map((taskId) =>
      enqueueJob('schedule:single-task', {
        userId,
        payload: { taskId },
        idempotencyKey: `schedule:single-task:${taskId}`,
      }),
    ),
  );

  // Self-trigger drain (fire-and-forget) — memory: project_drain_self_trigger
  fetch(
    new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
    { method: 'POST' },
  ).catch(() => {});

  return NextResponse.json({ taskIds });
}
