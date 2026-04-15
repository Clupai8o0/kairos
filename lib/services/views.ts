// lib/services/views.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { views } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type View = typeof views.$inferSelect;

export type CreateViewInput = {
  name: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
};

export type UpdateViewInput = {
  name?: string;
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
};

export async function listViews(userId: string): Promise<View[]> {
  return db.select().from(views).where(eq(views.userId, userId));
}

export async function getView(userId: string, id: string): Promise<View | null> {
  const [row] = await db.select().from(views).where(and(eq(views.id, id), eq(views.userId, userId)));
  return row ?? null;
}

export async function createView(userId: string, input: CreateViewInput): Promise<View> {
  const [row] = await db
    .insert(views)
    .values({ id: newId(), userId, ...input, updatedAt: new Date() })
    .returning();
  return row;
}

export async function updateView(userId: string, id: string, input: UpdateViewInput): Promise<View | null> {
  const [row] = await db
    .update(views)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(views.id, id), eq(views.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteView(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(views)
    .where(and(eq(views.id, id), eq(views.userId, userId)))
    .returning({ id: views.id });
  return !!deleted;
}
