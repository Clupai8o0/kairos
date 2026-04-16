// lib/gcal/events.ts
import { google } from 'googleapis';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';
import type { Task, PlacedChunk } from '@/lib/scheduler/types';

export async function upsertEvent(
  userId: string,
  calendarId: string,
  task: Task,
  chunk: PlacedChunk,
  existingEventId?: string | null,
): Promise<string> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const body = {
    summary: task.title,
    description: task.description ?? undefined,
    start: { dateTime: chunk.start.toISOString() },
    end: { dateTime: chunk.end.toISOString() },
  };

  try {
    if (existingEventId) {
      const res = await calendar.events.update({ calendarId, eventId: existingEventId, requestBody: body });
      return res.data.id!;
    }
    const res = await calendar.events.insert({ calendarId, requestBody: body });
    return res.data.id!;
  } catch (e) {
    throw mapGoogleError(e);
  }
}

export async function deleteEvent(
  userId: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    throw mapGoogleError(e);
  }
}
