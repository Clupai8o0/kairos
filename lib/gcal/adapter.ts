// lib/gcal/adapter.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';
import type { GCalAdapter } from '@/lib/scheduler/runner';
import { getFreeBusy } from './freebusy';
import { upsertEvent } from './events';

export function createGCalAdapter(userId: string): GCalAdapter {
  return {
    async getFreeBusy(calendarIds, start, end) {
      let ids = calendarIds;
      if (ids.length === 0) {
        const rows = await db
          .select({ calendarId: googleCalendars.calendarId })
          .from(googleCalendars)
          .where(and(eq(googleCalendars.userId, userId), eq(googleCalendars.selected, true)));
        ids = rows.map((r) => r.calendarId);
      }
      if (ids.length === 0) return [];
      return getFreeBusy(userId, ids, start, end);
    },

    async upsertEvent(calendarId, task, chunk, existingEventId) {
      return upsertEvent(userId, calendarId, task, chunk, existingEventId);
    },
  };
}
