// app/api/collections/[id]/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { addTaskToCollection } from '@/lib/services/collections';

const AddTaskSchema = z.object({
  taskId: z.string().min(1),
  phaseId: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = AddTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const ct = await addTaskToCollection(userId, id, parsed.data.taskId, {
    phaseId: parsed.data.phaseId,
  });
  if (!ct) return NextResponse.json({ error: 'Collection or task not found' }, { status: 404 });
  return NextResponse.json(ct, { status: 201 });
}
