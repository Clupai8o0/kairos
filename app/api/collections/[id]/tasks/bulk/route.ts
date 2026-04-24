// app/api/collections/[id]/tasks/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { addTasksToCollectionBulk } from '@/lib/services/collections';

const BulkAddSchema = z.object({
  tasks: z
    .array(
      z.object({
        taskId: z.string().min(1),
        phaseId: z.string().optional(),
      }),
    )
    .min(1)
    .max(100),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = BulkAddSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await addTasksToCollectionBulk(userId, id, parsed.data.tasks);
  if (result.added === 0 && result.invalid === parsed.data.tasks.length) {
    return NextResponse.json({ error: 'Collection not found or no valid tasks' }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
