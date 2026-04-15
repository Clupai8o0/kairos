// app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createTag, listTags } from '@/lib/services/tags';

const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listTags(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateTagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await createTag(userId, parsed.data);
  return NextResponse.json(tag, { status: 201 });
}
