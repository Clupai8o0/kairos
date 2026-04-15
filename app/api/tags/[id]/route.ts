// app/api/tags/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteTag, getTag, updateTag } from '@/lib/services/tags';

const UpdateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const tag = await getTag(userId, id);
  if (!tag) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tag);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateTagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await updateTag(userId, id, parsed.data);
  if (!tag) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tag);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteTag(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
