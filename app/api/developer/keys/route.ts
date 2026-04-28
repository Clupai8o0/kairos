// app/api/developer/keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { createApiKey, listApiKeys, ALL_SCOPES } from '@/lib/services/api-keys';
import type { ApiKeyScope } from '@/lib/services/api-keys';

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['tasks:read', 'tasks:write', 'schedule:run', 'gcal:sync', 'tags:read', 'tags:write', 'collections:read', 'collections:write', '*'])).min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const keys = await listApiKeys(userId);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const scopes = parsed.data.scopes.includes('*')
    ? ['*' as ApiKeyScope]
    : (parsed.data.scopes as ApiKeyScope[]);

  const result = await createApiKey(userId, {
    name: parsed.data.name,
    scopes,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
  });

  return NextResponse.json(
    {
      id: result.id,
      name: result.name,
      prefix: result.prefix,
      scopes: result.scopes,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
      key: result.key,
    },
    { status: 201 },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
