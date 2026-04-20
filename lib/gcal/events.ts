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

export interface GCalEventPatch {
  summary?: string;
  description?: string;
  start?: string; // ISO datetime
  end?: string;
}

export async function patchEvent(
  userId: string,
  calendarId: string,
  eventId: string,
  patch: GCalEventPatch,
): Promise<GCalEvent> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start !== undefined) body.start = { dateTime: patch.start };
  if (patch.end !== undefined) body.end = { dateTime: patch.end };
  try {
    const res = await calendar.events.patch({ calendarId, eventId, requestBody: body });
    const e = res.data;
    return {
      id: e.id!,
      summary: e.summary ?? null,
      description: e.description ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      calendarId,
      isAllDay: !e.start?.dateTime,
    };
  } catch (err) {
    throw mapGoogleError(err);
  }
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  colorId?: string; // GCal event color "1"–"11"
  timeZone?: string; // IANA timezone (e.g. "Europe/London")
}

export async function createEvent(
  userId: string,
  calendarId: string,
  input: CreateEventInput,
): Promise<GCalEvent> {
  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start, timeZone: input.timeZone },
        end: { dateTime: input.end, timeZone: input.timeZone },
        ...(input.colorId ? { colorId: input.colorId } : {}),
      },
    });
    const e = res.data;
    return {
      id: e.id!,
      summary: e.summary ?? null,
      description: e.description ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      calendarId,
      isAllDay: !e.start?.dateTime,
    };
  } catch (err) {
    throw mapGoogleError(err);
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
