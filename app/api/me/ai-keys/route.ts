// app/api/me/ai-keys/route.ts — CRUD for per-user LLM API keys
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listUserKeys, setUserKey, deleteUserKey, isValidProvider } from '@/lib/services/ai-keys';
import type { AiProvider } from '@/lib/services/ai-keys';

/** GET — list which providers have keys configured */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const keys = await listUserKeys(authResult.userId);
  // Also include env-level availability
  const envKeys = {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  };
  return Response.json({ keys, envKeys });
}

/** PUT — set/update an API key for a provider */
export async function PUT(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const provider = body.provider as string;
  const apiKey = body.apiKey as string;

  if (!provider || !isValidProvider(provider)) {
    return Response.json({ error: 'Invalid provider. Must be openai, anthropic, or google.' }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
    return Response.json({ error: 'API key is required and must be at least 10 characters.' }, { status: 400 });
  }

  await setUserKey(authResult.userId, provider as AiProvider, apiKey);
  return Response.json({ ok: true, provider });
}

/** DELETE — remove an API key for a provider */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  if (!provider || !isValidProvider(provider)) {
    return Response.json({ error: 'Invalid provider.' }, { status: 400 });
  }

  const deleted = await deleteUserKey(authResult.userId, provider as AiProvider);
  return Response.json({ ok: true, deleted });
}
