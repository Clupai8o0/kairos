// lib/services/blackouts.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { blackoutBlocks } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type BlackoutBlockRow = typeof blackoutBlocks.$inferSelect;

export type CreateBlackoutInput = {
  startAt: string;
  endAt: string;
  recurrenceRule?: Record<string, unknown> | null;
  reason?: string | null;
};

export type UpdateBlackoutInput = {
  startAt?: string;
  endAt?: string;
  recurrenceRule?: Record<string, unknown> | null;
  reason?: string | null;
};

export async function listBlackouts(userId: string): Promise<BlackoutBlockRow[]> {
  return db
    .select()
    .from(blackoutBlocks)
    .where(eq(blackoutBlocks.userId, userId))
    .orderBy(blackoutBlocks.startAt);
}

export async function getBlackout(
  userId: string,
  id: string,
): Promise<BlackoutBlockRow | null> {
  const [row] = await db
    .select()
    .from(blackoutBlocks)
    .where(and(eq(blackoutBlocks.id, id), eq(blackoutBlocks.userId, userId)));
  return row ?? null;
}

export async function createBlackout(
  userId: string,
  input: CreateBlackoutInput,
): Promise<BlackoutBlockRow> {
  const [row] = await db
    .insert(blackoutBlocks)
    .values({
      id: newId(),
      userId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      recurrenceRule: input.recurrenceRule ?? undefined,
      reason: input.reason ?? undefined,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateBlackout(
  userId: string,
  id: string,
  input: UpdateBlackoutInput,
): Promise<BlackoutBlockRow | null> {
  const patch: Partial<typeof blackoutBlocks.$inferInsert> = { updatedAt: new Date() };
  if (input.startAt !== undefined) {
    patch.startAt = new Date(input.startAt);
  }
  if (input.endAt !== undefined) {
    patch.endAt = new Date(input.endAt);
  }
  if (input.recurrenceRule !== undefined) {
    patch.recurrenceRule = input.recurrenceRule ?? null;
  }
  if (input.reason !== undefined) {
    patch.reason = input.reason ?? null;
  }

  const [row] = await db
    .update(blackoutBlocks)
    .set(patch)
    .where(and(eq(blackoutBlocks.id, id), eq(blackoutBlocks.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteBlackout(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(blackoutBlocks)
    .where(and(eq(blackoutBlocks.id, id), eq(blackoutBlocks.userId, userId)))
    .returning({ id: blackoutBlocks.id });
  return !!deleted;
}
