// lib/gcal/calendars.ts
import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { googleAccounts, googleCalendars } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';

export async function syncCalendars(userId: string) {
  const [gaRow] = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));

  if (!gaRow) return [];

  const auth = await getAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  let items: {
    id?: string | null;
    summary?: string | null;
    backgroundColor?: string | null;
    primary?: boolean | null;
  }[] = [];

  try {
    const res = await calendar.calendarList.list();
    items = res.data.items ?? [];
  } catch (e) {
    throw mapGoogleError(e);
  }

  const upserted = await Promise.all(
    items
      .filter((item) => !!item.id)
      .map(async (item) => {
        const [existing] = await db
          .select()
          .from(googleCalendars)
          .where(eq(googleCalendars.calendarId, item.id!));

        if (existing) {
          const [updated] = await db
            .update(googleCalendars)
            .set({ name: item.summary ?? '', color: item.backgroundColor, updatedAt: new Date() })
            .where(eq(googleCalendars.id, existing.id))
            .returning();
          return updated!;
        }

        const [inserted] = await db
          .insert(googleCalendars)
          .values({
            id: newId(),
            userId,
            googleAccountId: gaRow.id,
            calendarId: item.id!,
            name: item.summary ?? '',
            color: item.backgroundColor,
            isPrimary: item.primary ?? false,
          })
          .returning();
        return inserted!;
      }),
  );

  return upserted;
}
