// app/api/scratchpad/[id]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { processScratchpad } from '@/lib/services/scratchpad';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const pad = await processScratchpad(userId, id);
  if (!pad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pad);
}
