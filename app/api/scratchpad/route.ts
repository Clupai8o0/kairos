// app/api/scratchpad/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createScratchpad, listScratchpads } from '@/lib/services/scratchpad';

const CreateSchema = z.object({
  content: z.string().min(1),
  inputType: z.enum(['text', 'url', 'share', 'voice', 'file']).default('text'),
  title: z.string().optional(),
  inputPayload: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listScratchpads(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const pad = await createScratchpad(userId, parsed.data);
  return NextResponse.json(pad, { status: 201 });
}
