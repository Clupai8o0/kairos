// lib/services/scratchpad.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scratchpads, tasks, taskTags, tags } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { dispatchToPlugin } from '@/lib/plugins/host';
import type { ScratchpadInput } from '@/lib/plugins/types';

export type Scratchpad = typeof scratchpads.$inferSelect;

export interface CreateScratchpadInput {
  content: string;
  inputType: 'text' | 'url' | 'share' | 'voice' | 'file';
  title?: string;
  inputPayload?: Record<string, unknown>;
}

export async function createScratchpad(
  userId: string,
  input: CreateScratchpadInput,
): Promise<Scratchpad> {
  const [row] = await db
    .insert(scratchpads)
    .values({
      id: newId(),
      userId,
      content: input.content,
      inputType: input.inputType,
      title: input.title,
      inputPayload: input.inputPayload ?? {},
      updatedAt: new Date(),
    })
    .returning();
  return row!;
}

export async function listScratchpads(userId: string): Promise<Scratchpad[]> {
  return db.select().from(scratchpads).where(eq(scratchpads.userId, userId));
}

export async function getScratchpad(userId: string, id: string): Promise<Scratchpad | null> {
  const [row] = await db
    .select()
    .from(scratchpads)
    .where(and(eq(scratchpads.id, id), eq(scratchpads.userId, userId)));
  return row ?? null;
}

export async function deleteScratchpad(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(scratchpads)
    .where(and(eq(scratchpads.id, id), eq(scratchpads.userId, userId)))
    .returning({ id: scratchpads.id });
  return !!deleted;
}

export async function processScratchpad(userId: string, id: string): Promise<Scratchpad | null> {
  const pad = await getScratchpad(userId, id);
  if (!pad) return null;

  const pluginInput: ScratchpadInput = {
    id: pad.id,
    userId,
    inputType: pad.inputType as ScratchpadInput['inputType'],
    content: pad.content,
    payload: (pad.inputPayload ?? {}) as Record<string, unknown>,
    createdAt: pad.createdAt,
  };

  const result = await dispatchToPlugin(pluginInput, userId);

  const [updated] = await db
    .update(scratchpads)
    .set({
      processed: true,
      pluginName: result.pluginName,
      pluginVersion: result.pluginVersion,
      parseResult: result as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(scratchpads.id, id), eq(scratchpads.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function commitScratchpad(
  userId: string,
  id: string,
): Promise<{ taskIds: string[] }> {
  const pad = await getScratchpad(userId, id);
  if (!pad || !pad.parseResult) throw new Error('Scratchpad not processed');

  const parseResult = pad.parseResult as unknown as {
    tasks: Array<{
      title: string;
      description?: string | null;
      durationMins?: number | null;
      deadline?: Date | null;
      priority: number;
      tags: string[];
      sourceMetadata?: Record<string, unknown>;
    }>;
  };

  const taskIds: string[] = [];

  for (const candidate of parseResult.tasks) {
    const taskId = newId();

    await db.insert(tasks).values({
      id: taskId,
      userId,
      title: candidate.title,
      description: candidate.description ?? undefined,
      durationMins: candidate.durationMins ?? undefined,
      deadline: candidate.deadline ?? undefined,
      priority: candidate.priority,
      source: `scratchpad:${pad.pluginName ?? 'unknown'}`,
      sourceRef: pad.id,
      sourceMetadata: candidate.sourceMetadata ?? {},
      updatedAt: new Date(),
    });

    if (candidate.tags.length > 0) {
      for (const tagName of candidate.tags) {
        const [existing] = await db
          .select()
          .from(tags)
          .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));

        let tagId = existing?.id;
        if (!tagId) {
          tagId = newId();
          await db.insert(tags).values({ id: tagId, userId, name: tagName, updatedAt: new Date() });
        }
        await db.insert(taskTags).values({ taskId, tagId }).onConflictDoNothing();
      }
    }

    taskIds.push(taskId);
  }

  await db
    .update(scratchpads)
    .set({ extractedTaskIds: taskIds, updatedAt: new Date() })
    .where(eq(scratchpads.id, id));

  return { taskIds };
}
