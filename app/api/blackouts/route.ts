// app/api/blackouts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createBlackout, listBlackouts } from '@/lib/services/blackouts';

const RecurrenceRuleSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().optional(),
  byDayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  byDayOfMonth: z.number().int().min(1).max(31).optional(),
  until: z.string().optional(),
  count: z.number().int().positive().optional(),
});

const CreateBlackoutSchema = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  recurrenceRule: RecurrenceRuleSchema.nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  return NextResponse.json(await listBlackouts(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateBlackoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const blackout = await createBlackout(userId, parsed.data);
  return NextResponse.json(blackout, { status: 201 });
}
