// PATCH /api/me/theme — update the authenticated user's active theme pack
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { user, themeInstalls } from '@/lib/db/schema';
import { BUILT_IN_PACKS } from '@/app/styles/packs/manifest';

const Body = z.object({
  themeId: z.string().min(1),
});

const BUILT_IN_IDS = new Set(BUILT_IN_PACKS.map((p) => p.id));

export async function PATCH(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = Body.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { themeId } = body.data;

  // Accept built-in packs or themes installed by this user
  if (!BUILT_IN_IDS.has(themeId)) {
    const [install] = await db
      .select({ id: themeInstalls.id })
      .from(themeInstalls)
      .where(and(eq(themeInstalls.userId, userId), eq(themeInstalls.themeId, themeId)));

    if (!install) {
      return NextResponse.json({ error: 'Unknown theme pack' }, { status: 400 });
    }
  }

  await db.update(user).set({ activeThemeId: themeId }).where(eq(user.id, userId));
  return NextResponse.json({ themeId });
}
