import type { PluginContext } from './types.js';
import { z } from 'zod';

export interface MockContextOptions {
  userId?: string;
  pluginName?: string;
  config?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  rulesets?: Array<Record<string, unknown>>;
  /** Fixed string to return from complete() */
  completeResponse?: string | ((prompt: string) => string);
  /** Fixed value to parse via completeStructured() */
  completeStructuredResponse?: unknown;
}

type MockLog = { level: string; message: string; fields?: Record<string, unknown> };

export interface MockPluginContext extends PluginContext {
  _logs: MockLog[];
  _config: Record<string, unknown>;
  _memory: Record<string, unknown>;
}

/**
 * createMockContext — creates a mock PluginContext for unit-testing plugins.
 *
 * @example
 * ```typescript
 * import { createMockContext } from '@kairos/plugin-sdk/testing';
 *
 * const ctx = createMockContext({
 *   completeStructuredResponse: { tasks: [{ title: 'Buy milk', priority: 3, tags: [] }] },
 * });
 * const result = await myPlugin.parse(input, ctx);
 * expect(result.tasks).toHaveLength(1);
 * ```
 */
export function createMockContext(options: MockContextOptions = {}): MockPluginContext {
  const logs: MockLog[] = [];
  let config = { ...(options.config ?? {}) };
  let memory = { ...(options.memory ?? {}) };

  const ctx: MockPluginContext = {
    userId: options.userId ?? 'test-user',
    pluginName: options.pluginName ?? 'test-plugin',

    async getConfig<T>() { return config as T; },
    async setConfig<T>(c: T) { config = c as Record<string, unknown>; },

    async getMemory<T>() { return memory as T; },
    async setMemory<T>(m: T) { memory = m as Record<string, unknown>; },
    async updateMemory(patch) { memory = { ...memory, ...patch }; },

    async getRulesets() { return options.rulesets ?? []; },

    async complete(prompt: string) {
      if (typeof options.completeResponse === 'function') {
        return options.completeResponse(prompt);
      }
      return options.completeResponse ?? '';
    },

    async completeStructured<T>(_prompt: string, schema: z.ZodSchema<T>) {
      return schema.parse(options.completeStructuredResponse ?? {});
    },

    log(level, message, fields) {
      logs.push({ level, message, fields });
    },

    get _logs() { return logs; },
    get _config() { return config; },
    get _memory() { return memory; },
  };
  return ctx;
}
