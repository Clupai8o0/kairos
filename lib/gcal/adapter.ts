// lib/gcal/adapter.ts
import type { GCalAdapter } from '@/lib/scheduler/runner';
import { readBusyCache } from './busy-cache';
import { upsertEvent, deleteEvent } from './events';
import { getWriteCalendarId } from './calendars';

export function createGCalAdapter(userId: string): GCalAdapter {
  return {
    // Reads from the DB cache — call POST /api/gcal/sync to refresh it.
    // Never hits GCal live during scheduling (avoids rate-limit errors).
    async getFreeBusy(_calendarIds, _start, _end) {
      return readBusyCache(userId);
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
