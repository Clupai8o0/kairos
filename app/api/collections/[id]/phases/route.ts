// app/api/collections/[id]/phases/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createPhase } from '@/lib/services/collections';

const CreatePhaseSchema = z.object({
  title: z.string().min(1).max(200),
  order: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = CreatePhaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const phase = await createPhase(userId, id, parsed.data);
  if (!phase) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  return NextResponse.json(phase, { status: 201 });
}
