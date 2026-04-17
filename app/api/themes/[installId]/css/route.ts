import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { themeInstalls } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ installId: string }> },
) {
  const { installId } = await params;

  const [install] = await db
    .select({
      themeId: themeInstalls.themeId,
      version: themeInstalls.version,
      compiledCss: themeInstalls.compiledCss,
    })
    .from(themeInstalls)
    .where(eq(themeInstalls.id, installId));

  if (!install) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(install.compiledCss, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${install.themeId}@${install.version}"`,
    },
  });
}
