// lib/services/chat-sessions.ts
import { db } from '@/lib/db/client';
import { chatSessions } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { UIMessage } from 'ai';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listSessions(userId: string) {
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
  return rows;
}

export async function getSession(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)));
  return row ?? null;
}

export async function createSession(userId: string, title = 'New chat') {
  const [row] = await db
    .insert(chatSessions)
    .values({ id: newId(), userId, title, messages: [] })
    .returning();
  return row;
}

export async function updateSession(
  userId: string,
  id: string,
  data: { title?: string; messages?: UIMessage[] },
) {
  const [row] = await db
    .update(chatSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteSession(userId: string, id: string) {
  const [row] = await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)))
    .returning({ id: chatSessions.id });
  return row ?? null;
}
