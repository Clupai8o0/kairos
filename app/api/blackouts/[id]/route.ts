// app/api/blackouts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteBlackout, getBlackout, updateBlackout } from '@/lib/services/blackouts';

const RecurrenceRuleSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().optional(),
  byDayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  byDayOfMonth: z.number().int().min(1).max(31).optional(),
  until: z.string().optional(),
  count: z.number().int().positive().optional(),
});

const UpdateBlackoutSchema = z.object({
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  recurrenceRule: RecurrenceRuleSchema.nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const blackout = await getBlackout(userId, id);
  if (!blackout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(blackout);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateBlackoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const blackout = await updateBlackout(userId, id, parsed.data);
  if (!blackout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(blackout);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteBlackout(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
