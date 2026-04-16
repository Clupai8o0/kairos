// lib/services/schedule-windows.ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scheduleWindows } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type ScheduleWindowRow = typeof scheduleWindows.$inferSelect;

export type WindowInput = {
  dayOfWeek: number; // 0=Sun .. 6=Sat
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
};

export async function listScheduleWindows(userId: string): Promise<ScheduleWindowRow[]> {
  return db
    .select()
    .from(scheduleWindows)
    .where(eq(scheduleWindows.userId, userId))
    .orderBy(scheduleWindows.dayOfWeek, scheduleWindows.startTime);
}

/**
 * Replaces all schedule windows for the user atomically.
 * Passing an empty array clears all windows.
 */
export async function setScheduleWindows(
  userId: string,
  windows: WindowInput[],
): Promise<ScheduleWindowRow[]> {
  await db.delete(scheduleWindows).where(eq(scheduleWindows.userId, userId));

  if (windows.length === 0) return [];

  return db
    .insert(scheduleWindows)
    .values(
      windows.map((w) => ({
        id: newId(),
        userId,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
    )
    .returning();
}
