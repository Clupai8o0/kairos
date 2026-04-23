// app/api/collections/[id]/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getCollectionProgress } from '@/lib/services/collections';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const progress = await getCollectionProgress(userId, id);
  if (!progress) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(progress);
}
