import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listInstalledThemes } from '@/lib/themes/install';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const themes = await listInstalledThemes(auth.userId);
  return NextResponse.json(themes);
}
