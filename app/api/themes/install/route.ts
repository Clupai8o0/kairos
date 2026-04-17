import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { installManifest, installFromRegistryUrl } from '@/lib/themes/install';

const BodySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('registry'),
    downloadUrl: z.string().url(),
  }),
  z.object({
    mode: z.literal('custom'),
    manifest: z.string().min(1),
    source: z.enum(['custom-upload', 'plugin']).default('custom-upload'),
  }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    let result;
    if (parsed.data.mode === 'registry') {
      result = await installFromRegistryUrl(auth.userId, parsed.data.downloadUrl);
    } else {
      result = await installManifest(auth.userId, parsed.data.manifest, parsed.data.source);
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Install failed' },
      { status: 400 },
    );
  }
}
