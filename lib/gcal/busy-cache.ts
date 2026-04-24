// lib/gcal/busy-cache.ts
// Read and write the scheduled free/busy cache stored on googleAccounts.
// The scheduler always reads from here — POST /api/gcal/sync populates it.

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleAccounts } from '@/lib/db/schema';
import type { BusyInterval } from '@/lib/scheduler/types';

export async function readBusyCache(userId: string): Promise<BusyInterval[]> {
  const [row] = await db
    .select({ busyCacheJson: googleAccounts.busyCacheJson, busyCacheUpdatedAt: googleAccounts.busyCacheUpdatedAt })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));
  if (!row?.busyCacheJson) return [];
  return row.busyCacheJson.map((i) => ({
    start: new Date(i.start),
    end: new Date(i.end),
  }));
}

export async function writeBusyCache(userId: string, intervals: BusyInterval[]): Promise<Date> {
  const now = new Date();
  await db
    .update(googleAccounts)
    .set({
      busyCacheJson: intervals.map((i) => ({ start: i.start.toISOString(), end: i.end.toISOString() })),
      busyCacheUpdatedAt: now,
    })
    .where(eq(googleAccounts.userId, userId));
  return now;
}

export async function getBusyCacheAge(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ busyCacheUpdatedAt: googleAccounts.busyCacheUpdatedAt })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));
  return row?.busyCacheUpdatedAt ?? null;
}
