// app/api/scratchpad/[id]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { processScratchpad } from '@/lib/services/scratchpad';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { model?: string };
  const model = typeof body.model === 'string' ? body.model : undefined;

  const pad = await processScratchpad(userId, id, model);
  if (!pad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pad);
}
