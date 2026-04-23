// app/api/collections/[id]/tasks/[taskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { removeTaskFromCollection, updateCollectionTask } from '@/lib/services/collections';

const UpdateCollectionTaskSchema = z.object({
  phaseId: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id, taskId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateCollectionTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const ct = await updateCollectionTask(userId, id, taskId, parsed.data);
  if (!ct) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(ct);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id, taskId } = await params;
  const removed = await removeTaskFromCollection(userId, id, taskId);
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
