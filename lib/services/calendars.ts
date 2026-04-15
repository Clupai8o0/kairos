// lib/services/calendars.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';

export type GoogleCalendar = typeof googleCalendars.$inferSelect;

export async function listCalendars(userId: string): Promise<GoogleCalendar[]> {
  return db.select().from(googleCalendars).where(eq(googleCalendars.userId, userId));
}

export async function setCalendarSelected(
  userId: string,
  id: string,
  selected: boolean,
): Promise<GoogleCalendar | null> {
  const [row] = await db
    .update(googleCalendars)
    .set({ selected, updatedAt: new Date() })
    .where(and(eq(googleCalendars.id, id), eq(googleCalendars.userId, userId)))
    .returning();
  return row ?? null;
}
