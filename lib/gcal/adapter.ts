// lib/gcal/adapter.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';
import type { GCalAdapter } from '@/lib/scheduler/runner';
import { getFreeBusy } from './freebusy';
import { upsertEvent, deleteEvent } from './events';
import { getWriteCalendarId } from './calendars';

export function createGCalAdapter(userId: string): GCalAdapter {
  return {
    async getFreeBusy(calendarIds, start, end) {
      let ids = calendarIds;
      if (ids.length === 0) {
        const rows = await db
          .select({ calendarId: googleCalendars.calendarId })
          .from(googleCalendars)
          .where(and(
            eq(googleCalendars.userId, userId),
            eq(googleCalendars.selected, true),
            eq(googleCalendars.showAsBusy, true),
          ));
        ids = rows.map((r) => r.calendarId);
      }
      if (ids.length === 0) return [];
      return getFreeBusy(userId, ids, start, end);
    },

    async upsertEvent(_calendarId, task, chunk, existingEventId) {
      const writeId = await getWriteCalendarId(userId);
      return upsertEvent(userId, writeId, task, chunk, existingEventId);
    },

    async deleteEvent(_calendarId, eventId) {
      const writeId = await getWriteCalendarId(userId);
      return deleteEvent(userId, writeId, eventId);
    },
  };
}
