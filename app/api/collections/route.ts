// app/api/collections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createCollection, listCollections } from '@/lib/services/collections';

const CreateCollectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  color: z.string().optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  return NextResponse.json(await listCollections(userId));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateCollectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const collection = await createCollection(userId, parsed.data);
  return NextResponse.json(collection, { status: 201 });
}
