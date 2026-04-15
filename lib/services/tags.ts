// lib/services/tags.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tags } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type Tag = typeof tags.$inferSelect;

export type CreateTagInput = {
  name: string;
  color?: string;
};

export type UpdateTagInput = {
  name?: string;
  color?: string | null;
};

export async function listTags(userId: string): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.userId, userId));
}

export async function getTag(userId: string, id: string): Promise<Tag | null> {
  const [row] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
  return row ?? null;
}

export async function createTag(userId: string, input: CreateTagInput): Promise<Tag> {
  const [row] = await db
    .insert(tags)
    .values({ id: newId(), userId, ...input, updatedAt: new Date() })
    .returning();
  return row;
}

export async function updateTag(userId: string, id: string, input: UpdateTagInput): Promise<Tag | null> {
  const [row] = await db
    .update(tags)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteTag(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning({ id: tags.id });
  return !!deleted;
}
