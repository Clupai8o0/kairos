// lib/gcal/events.ts
import { google } from 'googleapis';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';
import type { Task, PlacedChunk } from '@/lib/scheduler/types';

export interface GCalEvent {
  id: string;
  summary: string | null;
  description: string | null;
  start: string; // ISO datetime or date (all-day)
  end: string;
  calendarId: string;
  isAllDay: boolean;
}

export async function listEvents(
  userId: string,
  calendarId: string,
  start: Date,
  end: Date,
): Promise<GCalEvent[]> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    return (res.data.items ?? [])
      .filter((e) => e.id && e.status !== 'cancelled')
      .map((e) => ({
        id: e.id!,
        summary: e.summary ?? null,
        description: e.description ?? null,
        start: e.start?.dateTime ?? e.start?.date ?? '',
        end: e.end?.dateTime ?? e.end?.date ?? '',
        calendarId,
        isAllDay: !e.start?.dateTime,
      }));
  } catch (e) {
    throw mapGoogleError(e);
  }
}

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
