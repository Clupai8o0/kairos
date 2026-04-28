// app/api/developer/keys/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteApiKey } from '@/lib/services/api-keys';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const deleted = await deleteApiKey(userId, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
