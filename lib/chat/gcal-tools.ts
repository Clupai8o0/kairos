// lib/chat/gcal-tools.ts — GCal event tools for chat surface
import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';
import { createEvent, listEvents, deleteEvent } from '@/lib/gcal/events';

async function getSelectedCalendarId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ calendarId: googleCalendars.calendarId })
    .from(googleCalendars)
    .where(and(eq(googleCalendars.userId, userId), eq(googleCalendars.selected, true)))
    .limit(1);
  return row?.calendarId ?? null;
}

export function createGCalTools(userId: string, opts?: { skipConfirmation?: boolean }) {
  const needsApproval = !opts?.skipConfirmation;

  return {
    createGCalEvent: tool({
      description:
        'Create a Google Calendar event (not a task). Use this for meetings, appointments, blocked time, or any event that is NOT a schedulable task. Requires the user to have a connected Google Calendar.',
      needsApproval,
      inputSchema: z.object({
        summary: z.string().describe('Event title'),
        description: z.string().optional().describe('Event description'),
        start: z.string().describe('Start time as ISO 8601 datetime (e.g. 2026-04-27T09:00:00)'),
        end: z.string().describe('End time as ISO 8601 datetime (e.g. 2026-04-27T10:00:00)'),
        eventName: z.string().optional().describe('Event title (for display in confirmation UI — always include this)'),
      }),
      execute: async (args) => {
        const calendarId = await getSelectedCalendarId(userId);
        if (!calendarId) {
          return { error: 'No Google Calendar connected. Go to Settings → Calendar to connect one.' };
        }
        const event = await createEvent(userId, calendarId, {
          summary: args.summary,
          description: args.description,
          start: args.start,
          end: args.end,
        });
        return { id: event.id, summary: event.summary, start: event.start, end: event.end };
      },
    }),

    listGCalEvents: tool({
      description:
        'List upcoming Google Calendar events within a date range. Defaults to the next 7 days if no range is specified.',
      inputSchema: z.object({
        startDate: z.string().optional().describe('Start of range as ISO 8601 date or datetime'),
        endDate: z.string().optional().describe('End of range as ISO 8601 date or datetime'),
      }),
      execute: async (args) => {
        const calendarId = await getSelectedCalendarId(userId);
        if (!calendarId) {
          return { error: 'No Google Calendar connected.' };
        }
        const now = new Date();
        const start = args.startDate ? new Date(args.startDate) : now;
        const end = args.endDate
          ? new Date(args.endDate)
          : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const events = await listEvents(userId, calendarId, start, end);
        return events.map((e) => ({
          id: e.id,
          summary: e.summary,
          start: e.start,
          end: e.end,
          isAllDay: e.isAllDay,
        }));
      },
    }),

    deleteGCalEvent: tool({
      description: 'Delete a Google Calendar event by ID.',
      needsApproval,
      inputSchema: z.object({
        eventId: z.string().describe('Google Calendar event ID to delete'),
        eventName: z.string().optional().describe('Event title (for display in confirmation UI)'),
      }),
      execute: async (args) => {
        const calendarId = await getSelectedCalendarId(userId);
        if (!calendarId) {
          return { error: 'No Google Calendar connected.' };
        }
        await deleteEvent(userId, calendarId, args.eventId);
        return { deleted: true, eventId: args.eventId };
      },
    }),
  };
}
