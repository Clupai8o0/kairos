import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { uninstallTheme } from '@/lib/themes/install';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ installId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { installId } = await params;
  await uninstallTheme(auth.userId, installId);
  return new NextResponse(null, { status: 204 });
}
