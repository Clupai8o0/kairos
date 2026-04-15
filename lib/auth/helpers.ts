// lib/auth/helpers.ts
import { auth } from './index';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Call at the top of every route handler.
 * Returns { userId } on success, or a 401 Response to return immediately.
 *
 * Usage:
 *   const authResult = await requireAuth();
 *   if (authResult instanceof Response) return authResult;
 *   const { userId } = authResult;
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId: session.user.id };
}
