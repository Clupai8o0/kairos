// app/api/cron/drain/route.ts
import { NextResponse } from 'next/server';
import { claimPendingJobs, markJobDone, markJobFailed } from '@/lib/services/jobs';
import { scheduleSingleTask, scheduleFullRunChunk } from '@/lib/scheduler/runner';
import type { Job } from '@/lib/db/schema/jobs';

const DRAIN_LIMIT = 5;

// GCal writes are intentionally omitted here — the scheduler only updates the DB.
// Event creation/updates happen when the user presses "Sync GCal" (POST /api/gcal/sync).
async function processJob(job: Job) {
  const payload = job.payload as Record<string, unknown>;

  if (job.type === 'schedule:single-task') {
    const { taskId } = payload as { taskId: string };
    await scheduleSingleTask(job.userId!, taskId);
    return;
  }

  if (job.type === 'schedule:full-run') {
    const { remaining } = await scheduleFullRunChunk(job.userId!);
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
