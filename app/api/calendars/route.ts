// app/api/calendars/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listCalendars } from '@/lib/services/calendars';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listCalendars(userId));
}
