import { ParseResultSchema } from './types.js';
import type { ScratchpadPlugin, CandidateTask } from './types.js';

/**
 * definePlugin — type-safe factory for Kairos plugins.
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@kairos/plugin-sdk';
 *
 * export default definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   displayName: 'My Plugin',
 *   description: 'Extracts tasks from ...',
 *   author: 'Your Name',
 *   handlesInputTypes: ['url'] as const,
 *   canHandle: (input) => input.inputType === 'url' && input.content.includes('example.com'),
 *   async parse(input, ctx) {
 *     const tasks = await extractTasks(input.content, ctx);
 *     return createParseResult({ pluginName: 'my-plugin', pluginVersion: '1.0.0', tasks });
 *   },
 * });
 * ```
 */
export function definePlugin(definition: ScratchpadPlugin): ScratchpadPlugin {
  return definition;
}

/**
 * createParseResult — builds a validated ParseResult.
 * Throws if any task is malformed.
 */
export function createParseResult(result: {
  pluginName: string;
  pluginVersion: string;
  tasks: CandidateTask[];
  rawOutput?: Record<string, unknown>;
  warnings?: string[];
}) {
  return ParseResultSchema.parse({
    ...result,
    rawOutput: result.rawOutput ?? {},
    warnings: result.warnings ?? [],
  });
}
