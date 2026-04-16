// lib/plugins/context.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scratchpadPluginConfigs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';
import { complete as llmComplete, completeStructured as llmCompleteStructured } from '@/lib/llm';
import type { PluginContext, CompletionOptions } from './types';
import type { z } from 'zod';

async function getOrCreate(userId: string, pluginName: string) {
  const [row] = await db
    .select()
    .from(scratchpadPluginConfigs)
    .where(and(eq(scratchpadPluginConfigs.userId, userId), eq(scratchpadPluginConfigs.pluginName, pluginName)));
  if (row) return row;

  const [created] = await db
    .insert(scratchpadPluginConfigs)
    .values({ id: newId(), userId, pluginName })
    .returning();
  return created!;
}

export function createPluginContext(userId: string, pluginName: string): PluginContext {
  const where = () => and(eq(scratchpadPluginConfigs.userId, userId), eq(scratchpadPluginConfigs.pluginName, pluginName));

  return {
    userId,
    pluginName,

    async getConfig<T>() {
      const row = await getOrCreate(userId, pluginName);
      return row.config as T;
    },

    async setConfig<T>(config: T) {
      await getOrCreate(userId, pluginName);
      await db.update(scratchpadPluginConfigs).set({ config: config as Record<string, unknown>, updatedAt: new Date() }).where(where());
    },

    async getMemory<T>() {
      const row = await getOrCreate(userId, pluginName);
      return row.memory as T;
    },

    async setMemory<T>(memory: T) {
      await getOrCreate(userId, pluginName);
      await db.update(scratchpadPluginConfigs).set({ memory: memory as Record<string, unknown>, updatedAt: new Date() }).where(where());
    },

    async updateMemory(patch) {
      const row = await getOrCreate(userId, pluginName);
      const merged = { ...(row.memory as Record<string, unknown>), ...patch };
      await db.update(scratchpadPluginConfigs).set({ memory: merged, updatedAt: new Date() }).where(where());
    },

    async getRulesets() {
      const row = await getOrCreate(userId, pluginName);
      return row.rulesets as Array<Record<string, unknown>>;
    },

    async complete(prompt: string, _options?: CompletionOptions) {
      return llmComplete(prompt);
    },

    async completeStructured<T>(prompt: string, schema: z.ZodSchema<T>) {
      return llmCompleteStructured(prompt, schema);
    },

    log(level, message, fields) {
      console[level](`[plugin:${pluginName}]`, message, fields ?? '');
    },
  };
}
