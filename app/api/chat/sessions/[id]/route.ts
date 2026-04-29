// app/api/chat/sessions/[id]/route.ts
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getSession, updateSession, deleteSession } from '@/lib/services/chat-sessions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const session = await getSession(auth.userId, id);
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(session);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { title?: string; messages?: unknown[] } = {};
  if (typeof body.title === 'string') data.title = body.title;
  if (Array.isArray(body.messages)) data.messages = body.messages;
  const session = await updateSession(auth.userId, id, data as Parameters<typeof updateSession>[2]);
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(session);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const deleted = await deleteSession(auth.userId, id);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ deleted: true });
}
