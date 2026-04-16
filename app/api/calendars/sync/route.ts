// app/api/calendars/sync/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { syncCalendars } from '@/lib/gcal/calendars';

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const calendars = await syncCalendars(userId);
  return NextResponse.json(calendars);
}
