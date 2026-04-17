// app/api/plugins/install/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { installPluginFromUrl, installPluginManifest } from '@/lib/plugins/install';

const InstallFromUrlSchema = z.object({
  type: z.literal('url'),
  downloadUrl: z.string().url(),
  source: z.enum(['marketplace', 'custom-upload']).default('marketplace'),
});

const InstallFromManifestSchema = z.object({
  type: z.literal('manifest'),
  manifest: z.string().min(1),
  source: z.enum(['marketplace', 'custom-upload']).default('custom-upload'),
});

const InstallSchema = z.discriminatedUnion('type', [InstallFromUrlSchema, InstallFromManifestSchema]);

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = InstallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result =
      parsed.data.type === 'url'
        ? await installPluginFromUrl(userId, parsed.data.downloadUrl, parsed.data.source)
        : await installPluginManifest(userId, parsed.data.manifest, parsed.data.source);

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Installation failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}