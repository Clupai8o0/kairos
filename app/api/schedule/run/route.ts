// app/api/schedule/run/route.ts
// GCal writes are intentionally omitted — scheduler only updates the DB.
// Press "Sync GCal" (POST /api/gcal/sync) to push scheduled tasks to Google Calendar.
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { enqueueJob } from '@/lib/services/jobs';
import { scheduleFullRunChunk } from '@/lib/scheduler/runner';

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { scheduled, remaining } = await scheduleFullRunChunk(userId);

  if (remaining > 0) {
    await enqueueJob('schedule:full-run', {
      userId,
      idempotencyKey: `schedule:full-run:${userId}:${new Date().toISOString().slice(0, 13)}`,
    });
  }

  return NextResponse.json({ scheduled, remaining });
}
