// app/api/schedule/run/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { enqueueJob } from '@/lib/services/jobs';
import { scheduleFullRunChunk } from '@/lib/scheduler/runner';
import { db } from '@/lib/db/client';
import { googleAccounts } from '@/lib/db/schema';
import { createGCalAdapter } from '@/lib/gcal/adapter';

async function getGcal(userId: string) {
  const [acct] = await db
    .select({ id: googleAccounts.id })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));
  return acct ? createGCalAdapter(userId) : undefined;
}

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const gcal = await getGcal(userId);
  const { scheduled, remaining } = await scheduleFullRunChunk(userId, gcal);

  // If more tasks remain beyond the first chunk, enqueue a follow-up
  if (remaining > 0) {
    await enqueueJob('schedule:full-run', {
      userId,
      idempotencyKey: `schedule:full-run:${userId}:${new Date().toISOString().slice(0, 13)}`,
    });
  }

  return NextResponse.json({ scheduled, remaining });
}
