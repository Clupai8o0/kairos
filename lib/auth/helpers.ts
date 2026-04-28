// lib/auth/helpers.ts
import { auth } from './index';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/services/api-keys';

/**
 * Call at the top of every route handler.
 * Checks Authorization: Bearer kairos_sk_... first (API key auth),
 * then falls back to session cookie auth.
 * Returns { userId } on success, or a 401 Response to return immediately.
 *
 * Usage:
 *   const authResult = await requireAuth();
 *   if (authResult instanceof Response) return authResult;
 *   const { userId } = authResult;
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const reqHeaders = await headers();

  const authHeader = reqHeaders.get('authorization');
  if (authHeader?.startsWith('Bearer kairos_sk_')) {
    const rawKey = authHeader.slice('Bearer '.length).trim();
    const result = await verifyApiKey(rawKey);
    if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return result;
  }

  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId: session.user.id };
}
