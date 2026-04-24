// app/api/gcal/sync/route.ts
// Fetches live free/busy data from Google Calendar and writes it to the DB cache.
// The scheduler always reads from this cache; it never hits GCal live during placement.
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { googleAccounts, googleCalendars } from '@/lib/db/schema';
import { getFreeBusy } from '@/lib/gcal/freebusy';
import { writeBusyCache, getBusyCacheAge } from '@/lib/gcal/busy-cache';

const LOOKAHEAD_DAYS = 14;

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const updatedAt = await getBusyCacheAge(userId);
  return NextResponse.json({ updatedAt: updatedAt?.toISOString() ?? null });
}

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const [acct] = await db
    .select({ id: googleAccounts.id })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));

  if (!acct) {
    return NextResponse.json({ error: 'No Google account connected' }, { status: 400 });
  }

  const calRows = await db
    .select({ calendarId: googleCalendars.calendarId })
    .from(googleCalendars)
    .where(and(
      eq(googleCalendars.userId, userId),
      eq(googleCalendars.selected, true),
      eq(googleCalendars.showAsBusy, true),
    ));

  if (calRows.length === 0) {
    const updatedAt = await writeBusyCache(userId, []);
    return NextResponse.json({ intervalCount: 0, updatedAt: updatedAt.toISOString() });
  }

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + LOOKAHEAD_DAYS);

  const intervals = await getFreeBusy(userId, calRows.map((r) => r.calendarId), from, to);
  const updatedAt = await writeBusyCache(userId, intervals);

  return NextResponse.json({ intervalCount: intervals.length, updatedAt: updatedAt.toISOString() });
}
