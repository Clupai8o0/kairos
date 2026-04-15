// app/api/calendars/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { setCalendarSelected } from '@/lib/services/calendars';

const PatchCalendarSchema = z.object({
  selected: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchCalendarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const calendar = await setCalendarSelected(userId, id, parsed.data.selected);
  if (!calendar) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(calendar);
}
