// app/api/scratchpad/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getScratchpad, deleteScratchpad } from '@/lib/services/scratchpad';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const pad = await getScratchpad(userId, id);
  if (!pad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pad);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const deleted = await deleteScratchpad(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
