// lib/gcal/freebusy.ts
import { google } from 'googleapis';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';
import type { BusyInterval } from '@/lib/scheduler/types';

export async function getFreeBusy(
  userId: string,
  calendarIds: string[],
  start: Date,
  end: Date,
): Promise<BusyInterval[]> {
  if (calendarIds.length === 0) return [];

  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      },
    });

    const intervals: BusyInterval[] = [];
    for (const cal of Object.values(res.data.calendars ?? {})) {
      for (const busy of (cal as { busy?: { start?: string; end?: string }[] }).busy ?? []) {
        if (busy.start && busy.end) {
          intervals.push({ start: new Date(busy.start), end: new Date(busy.end) });
        }
      }
    }
    return intervals;
  } catch (e) {
    throw mapGoogleError(e);
  }
}
