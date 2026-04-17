import { z } from 'zod';

export const ScratchpadInputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  inputType: z.enum(['text', 'url', 'share', 'voice', 'file']),
  content: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});

export const CandidateTaskSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  durationMins: z.number().int().nullable().optional(),
  deadline: z.date().nullable().optional(),
  priority: z.number().int().min(1).max(4).default(3),
  tags: z.array(z.string()).default([]),
  sourceMetadata: z.record(z.string(), z.unknown()).default({}),
});

export const ParseResultSchema = z.object({
  pluginName: z.string(),
  pluginVersion: z.string(),
  tasks: z.array(CandidateTaskSchema),
  rawOutput: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()).default([]),
});

export type ScratchpadInput = z.infer<typeof ScratchpadInputSchema>;
export type CandidateTask = z.infer<typeof CandidateTaskSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface PluginContext {
  userId: string;
  pluginName: string;
  getConfig<T = Record<string, unknown>>(): Promise<T>;
  setConfig<T = Record<string, unknown>>(config: T): Promise<void>;
  getMemory<T = Record<string, unknown>>(): Promise<T>;
  setMemory<T = Record<string, unknown>>(memory: T): Promise<void>;
  updateMemory(patch: Record<string, unknown>): Promise<void>;
  getRulesets(): Promise<Array<Record<string, unknown>>>;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeStructured<T>(prompt: string, schema: z.ZodSchema<T>, options?: CompletionOptions): Promise<T>;
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void;
}

export interface ScratchpadPlugin {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  handlesInputTypes: ReadonlyArray<ScratchpadInput['inputType']>;
  canHandle(input: ScratchpadInput): boolean;
  parse(input: ScratchpadInput, context: PluginContext): Promise<ParseResult>;
  onInstall?(context: PluginContext): Promise<void>;
  onUninstall?(context: PluginContext): Promise<void>;
}
