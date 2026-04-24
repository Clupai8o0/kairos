// GET + PATCH /api/me/preferences
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { userPreferences } from '@/lib/db/schema';

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

const PatchBody = z.object({
  defaultBufferMins: z.number().int().min(0).max(120).optional(),
  defaultDurationMins: z.number().int().positive().nullable().optional(),
  defaultPriority: z.number().int().min(1).max(4).optional(),
  defaultSchedulable: z.boolean().optional(),
  timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), { message: 'Invalid IANA timezone' }).optional(),
});

async function getOrCreate(userId: string) {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));

  if (existing) return existing;

  const [created] = await db
    .insert(userPreferences)
    .values({ userId })
    .returning();

  return created;
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const prefs = await getOrCreate(authResult.userId);
  return NextResponse.json(prefs);
}

export async function PATCH(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = PatchBody.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  await getOrCreate(userId);

  const [updated] = await db
    .update(userPreferences)
    .set(body.data)
    .where(eq(userPreferences.userId, userId))
    .returning();

  return NextResponse.json(updated);
}
