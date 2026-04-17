// app/api/plugins/[name]/uninstall/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { pluginInstalls } from '@/lib/db/schema';
import { uninstallPlugin } from '@/lib/plugins/install';

type Params = { params: Promise<{ name: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { name } = await params;

  const [install] = await db
    .select({ id: pluginInstalls.id })
    .from(pluginInstalls)
    .where(and(eq(pluginInstalls.userId, userId), eq(pluginInstalls.pluginName, name)));

  if (!install) {
    return NextResponse.json({ error: 'Plugin not installed' }, { status: 404 });
  }

  await uninstallPlugin(userId, install.id);
  return new NextResponse(null, { status: 204 });
}