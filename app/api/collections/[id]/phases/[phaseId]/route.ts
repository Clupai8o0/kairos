// app/api/collections/[id]/phases/[phaseId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { updatePhase, deletePhase } from '@/lib/services/collections';

const UpdatePhaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  order: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string; phaseId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id, phaseId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdatePhaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const phase = await updatePhase(userId, id, phaseId, parsed.data);
  if (!phase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(phase);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id, phaseId } = await params;
  const deleted = await deletePhase(userId, id, phaseId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
