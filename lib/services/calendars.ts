// lib/services/calendars.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleCalendars } from '@/lib/db/schema';

export type GoogleCalendar = typeof googleCalendars.$inferSelect;

export async function listCalendars(userId: string): Promise<GoogleCalendar[]> {
  return db.select().from(googleCalendars).where(eq(googleCalendars.userId, userId));
}

export async function updateCalendar(
  userId: string,
  id: string,
  patch: { selected?: boolean; showAsBusy?: boolean; isWriteCalendar?: boolean },
): Promise<GoogleCalendar | null> {
  // isWriteCalendar is exclusive — clear all others first
  if (patch.isWriteCalendar) {
    await db
      .update(googleCalendars)
      .set({ isWriteCalendar: false, updatedAt: new Date() })
      .where(eq(googleCalendars.userId, userId));
  }
  const [row] = await db
    .update(googleCalendars)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(googleCalendars.id, id), eq(googleCalendars.userId, userId)))
    .returning();
  return row ?? null;
}

// Kept for backwards-compat with existing callers
export const setCalendarSelected = (userId: string, id: string, selected: boolean) =>
  updateCalendar(userId, id, { selected });
