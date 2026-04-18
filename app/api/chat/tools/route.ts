import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getAvailableToolNames } from '@/lib/chat/router';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const names = await getAvailableToolNames(userId);
  return NextResponse.json(names);
}
