// app/api/cron/drain/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleAccounts } from '@/lib/db/schema';
import { claimPendingJobs, markJobDone, markJobFailed } from '@/lib/services/jobs';
import { scheduleSingleTask, scheduleFullRunChunk } from '@/lib/scheduler/runner';
import { createGCalAdapter } from '@/lib/gcal/adapter';
import type { Job } from '@/lib/db/schema/jobs';

const DRAIN_LIMIT = 5;

async function getGcal(userId: string | null) {
  if (!userId) return undefined;
  const [acct] = await db
    .select({ id: googleAccounts.id })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));
  return acct ? createGCalAdapter(userId) : undefined;
}

async function processJob(job: Job) {
  const payload = job.payload as Record<string, unknown>;

  if (job.type === 'schedule:single-task') {
    const { taskId } = payload as { taskId: string };
    const gcal = await getGcal(job.userId ?? null);
    await scheduleSingleTask(job.userId!, taskId, gcal);
    return;
  }

  if (job.type === 'schedule:full-run') {
    const gcal = await getGcal(job.userId ?? null);
    const { remaining } = await scheduleFullRunChunk(job.userId!, gcal);
    if (remaining > 0) {
      const { enqueueJob } = await import('@/lib/services/jobs');
      await enqueueJob('schedule:full-run', { userId: job.userId ?? undefined });
    }
    return;
  }

  throw new Error(`Unknown job type: ${job.type}`);
}

async function drain() {
  const claimed = await claimPendingJobs(DRAIN_LIMIT);
  const results = await Promise.allSettled(
    claimed.map(async (job) => {
      try {
        await processJob(job);
        await markJobDone(job.id);
      } catch (e) {
        await markJobFailed(job.id, String(e), job.maxAttempts, job.attempts);
        throw e;
      }
    }),
  );

  return {
    drained: claimed.length,
    succeeded: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}

export async function GET() {
  const summary = await drain();
  return NextResponse.json(summary);
}

export { GET as POST };
