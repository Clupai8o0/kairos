// lib/services/window-templates.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { windowTemplates } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type WindowTemplateRow = typeof windowTemplates.$inferSelect;

export type CreateWindowTemplateInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  isDefault?: boolean;
};

export type UpdateWindowTemplateInput = {
  name?: string;
  description?: string | null;
  color?: string | null;
  isDefault?: boolean;
};

export async function listWindowTemplates(userId: string): Promise<WindowTemplateRow[]> {
  return db
    .select()
    .from(windowTemplates)
    .where(eq(windowTemplates.userId, userId))
    .orderBy(windowTemplates.createdAt);
}

export async function getWindowTemplate(
  userId: string,
  id: string,
): Promise<WindowTemplateRow | null> {
  const [row] = await db
    .select()
    .from(windowTemplates)
    .where(and(eq(windowTemplates.id, id), eq(windowTemplates.userId, userId)));
  return row ?? null;
}

export async function createWindowTemplate(
  userId: string,
  input: CreateWindowTemplateInput,
): Promise<WindowTemplateRow> {
  if (input.isDefault) {
    await db
      .update(windowTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(windowTemplates.userId, userId), eq(windowTemplates.isDefault, true)));
  }

  const [row] = await db
    .insert(windowTemplates)
    .values({
      id: newId(),
      userId,
      name: input.name,
      description: input.description ?? undefined,
      color: input.color ?? undefined,
      isDefault: input.isDefault ?? false,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateWindowTemplate(
  userId: string,
  id: string,
  input: UpdateWindowTemplateInput,
): Promise<WindowTemplateRow | null> {
  if (input.isDefault) {
    await db
      .update(windowTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(windowTemplates.userId, userId), eq(windowTemplates.isDefault, true)));
  }

  const patch: Partial<typeof windowTemplates.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.isDefault !== undefined) patch.isDefault = input.isDefault;

  const [row] = await db
    .update(windowTemplates)
    .set(patch)
    .where(and(eq(windowTemplates.id, id), eq(windowTemplates.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteWindowTemplate(userId: string, id: string): Promise<boolean> {
  const existing = await getWindowTemplate(userId, id);
  if (!existing) return false;
  if (existing.isDefault) return false;

  const [deleted] = await db
    .delete(windowTemplates)
    .where(and(eq(windowTemplates.id, id), eq(windowTemplates.userId, userId)))
    .returning({ id: windowTemplates.id });
  return !!deleted;
}

export async function ensureDefaultTemplate(userId: string): Promise<WindowTemplateRow> {
  const [existing] = await db
    .select()
    .from(windowTemplates)
    .where(and(eq(windowTemplates.userId, userId), eq(windowTemplates.isDefault, true)));
  if (existing) return existing;

  return createWindowTemplate(userId, { name: 'Default', isDefault: true });
}
