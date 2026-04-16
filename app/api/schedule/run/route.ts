// app/api/schedule/run/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { enqueueJob } from '@/lib/services/jobs';

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const job = await enqueueJob('schedule:full-run', {
    userId,
    // Idempotency key prevents multiple full-runs queued in the same hour
    idempotencyKey: `schedule:full-run:${userId}:${new Date().toISOString().slice(0, 13)}`,
  });

  // Self-trigger drain (fire-and-forget)
  fetch(
    new URL('/api/cron/drain', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
    { method: 'POST' },
  ).catch(() => {});

  return NextResponse.json({ jobId: job?.id ?? null, status: 'queued' });
}
