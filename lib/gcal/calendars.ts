// lib/gcal/calendars.ts
import { google } from 'googleapis';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { account, user, googleAccounts, googleCalendars } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { getAuthClient } from './auth';
import { mapGoogleError } from './errors';

export async function syncCalendars(userId: string) {
  // Better Auth stores OAuth tokens in the `account` table (not our custom googleAccounts)
  const [baAccount] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')));

  if (!baAccount) return [];

  const [userRow] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId));

  if (!userRow) return [];

  // Ensure our googleAccounts row exists (required FK for googleCalendars)
  const [existingGa] = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId));

  let gaId: string;
  if (existingGa) {
    await db
      .update(googleAccounts)
      .set({ googleAccountId: baAccount.accountId, email: userRow.email, updatedAt: new Date() })
      .where(eq(googleAccounts.id, existingGa.id));
    gaId = existingGa.id;
  } else {
    const [inserted] = await db
      .insert(googleAccounts)
      .values({
        id: newId(),
        userId,
        googleAccountId: baAccount.accountId,
        email: userRow.email,
      })
      .returning();
    gaId = inserted!.id;
  }

  // Fetch calendar list from Google
  const auth = await getAuthClient(userId);
  const cal = google.calendar({ version: 'v3', auth });

  let items: {
    id?: string | null;
    summary?: string | null;
    backgroundColor?: string | null;
    primary?: boolean | null;
  }[] = [];

  try {
    const res = await cal.calendarList.list();
    items = res.data.items ?? [];
  } catch (e) {
    throw mapGoogleError(e);
  }

  // Upsert each calendar
  const upserted = await Promise.all(
    items
      .filter((item) => !!item.id)
      .map(async (item) => {
        const [existing] = await db
          .select()
          .from(googleCalendars)
          .where(and(eq(googleCalendars.calendarId, item.id!), eq(googleCalendars.userId, userId)));

        if (existing) {
          const [updated] = await db
            .update(googleCalendars)
            .set({ name: item.summary ?? '', color: item.backgroundColor ?? null, updatedAt: new Date() })
            .where(eq(googleCalendars.id, existing.id))
            .returning();
          return updated!;
        }

        const [inserted] = await db
          .insert(googleCalendars)
          .values({
            id: newId(),
            userId,
            googleAccountId: gaId,
            calendarId: item.id!,
            name: item.summary ?? '',
            color: item.backgroundColor ?? null,
            isPrimary: item.primary ?? false,
          })
          .returning();
        return inserted!;
      }),
  );

  return upserted;
}
