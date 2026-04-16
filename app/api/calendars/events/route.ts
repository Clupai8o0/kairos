// app/api/calendars/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listCalendars } from '@/lib/services/calendars';
import { listEvents, type GCalEvent } from '@/lib/gcal/events';

interface CalendarEventResponse extends GCalEvent {
  calendarColor: string | null;
  calendarName: string;
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(req.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');
  if (!startStr || !endStr) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const calendars = await listCalendars(userId);
  const selected = calendars.filter((c) => c.selected);

  const results = await Promise.allSettled(
    selected.map(async (cal): Promise<CalendarEventResponse[]> => {
      const events = await listEvents(userId, cal.calendarId, new Date(startStr), new Date(endStr));
      return events.map((e) => ({ ...e, calendarColor: cal.color ?? null, calendarName: cal.name }));
    }),
  );

  const events = results
    .filter((r): r is PromiseFulfilledResult<CalendarEventResponse[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return NextResponse.json(events);
}
