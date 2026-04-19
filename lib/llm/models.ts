// lib/llm/models.ts — Shared model catalog for client and server
// Keep in sync with MODEL_CATALOG in lib/llm/index.ts
export type LLMProvider = 'openai' | 'anthropic' | 'google';

export interface ModelInfo {
  id: string;
  provider: LLMProvider;
  label: string;
  contextWindow: string;
}

export const MODELS: ModelInfo[] = [
  // OpenAI
  { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', contextWindow: '128k' },
  { id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o Mini', contextWindow: '128k' },
  { id: 'gpt-4.1', provider: 'openai', label: 'GPT-4.1', contextWindow: '1M' },
  { id: 'gpt-4.1-mini', provider: 'openai', label: 'GPT-4.1 Mini', contextWindow: '1M' },
  { id: 'gpt-4.1-nano', provider: 'openai', label: 'GPT-4.1 Nano', contextWindow: '1M' },
  { id: 'o3-mini', provider: 'openai', label: 'o3-mini', contextWindow: '200k' },
  // Anthropic
  { id: 'claude-sonnet-4-20250514', provider: 'anthropic', label: 'Claude Sonnet 4', contextWindow: '200k' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5', contextWindow: '200k' },
  { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', label: 'Claude 3.5 Sonnet', contextWindow: '200k' },
  // Google
  { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash', contextWindow: '1M' },
  { id: 'gemini-2.5-pro', provider: 'google', label: 'Gemini 2.5 Pro', contextWindow: '1M' },
  { id: 'gemini-2.0-flash', provider: 'google', label: 'Gemini 2.0 Flash', contextWindow: '1M' },
];

export const DEFAULT_MODEL_ID = 'gpt-4o-mini';
