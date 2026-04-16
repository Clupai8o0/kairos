// lib/gcal/auth.ts
import { google } from 'googleapis';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { account } from '@/lib/db/schema';
import { GCalAuthError } from './errors';

export async function getAuthClient(userId: string) {
  const [row] = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, 'google'),
      ),
    );

  if (!row) throw new GCalAuthError('No Google account connected for this user');

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: row.accessTokenExpiresAt?.getTime(),
  });

  // When googleapis auto-refreshes, persist the new token to DB
  oauth2.on('tokens', async (tokens) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (tokens.access_token) patch.accessToken = tokens.access_token;
    if (tokens.expiry_date) patch.accessTokenExpiresAt = new Date(tokens.expiry_date);
    await db.update(account).set(patch).where(eq(account.id, row.id));
  });

  return oauth2;
}
