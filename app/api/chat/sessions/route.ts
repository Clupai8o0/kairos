// app/api/chat/sessions/route.ts
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { listSessions, createSession } from '@/lib/services/chat-sessions';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const sessions = await listSessions(auth.userId);
  return Response.json(sessions);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title : 'New chat';
  const session = await createSession(auth.userId, title);
  return Response.json(session, { status: 201 });
}
