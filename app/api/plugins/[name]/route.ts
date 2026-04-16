// app/api/plugins/[name]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { getPluginWithConfig } from '@/lib/plugins/host';
import { db } from '@/lib/db/client';
import { scratchpadPluginConfigs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

type Params = { params: Promise<{ name: string }> };

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  rulesets: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { name } = await params;

  const plugin = await getPluginWithConfig(userId, name);
  if (!plugin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(plugin);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  const { name } = await params;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [existing] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(and(eq(scratchpadPluginConfigs.userId, userId), eq(scratchpadPluginConfigs.pluginName, name)));

  if (existing) {
    await db
      .update(scratchpadPluginConfigs)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(scratchpadPluginConfigs.id, existing.id));
  } else {
    await db.insert(scratchpadPluginConfigs).values({
      id: newId(), userId, pluginName: name, ...parsed.data,
    });
  }

  return NextResponse.json(await getPluginWithConfig(userId, name));
}
