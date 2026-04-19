// lib/llm/models.ts — Shared model catalog for client and server
// Keep in sync with MODEL_CATALOG in lib/llm/index.ts
export type LLMProvider = 'openai' | 'anthropic' | 'google';

export interface ModelInfo {
  id: string;
  provider: LLMProvider;
  label: string;
  contextWindow: string;
  /** Cost per 1M input tokens in USD */
  inputCost: number;
  /** Cost per 1M output tokens in USD */
  outputCost: number;
}

export const MODELS: ModelInfo[] = [
  // OpenAI
  { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', contextWindow: '128k', inputCost: 2.50, outputCost: 10.00 },
  { id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o Mini', contextWindow: '128k', inputCost: 0.15, outputCost: 0.60 },
  { id: 'gpt-4.1', provider: 'openai', label: 'GPT-4.1', contextWindow: '1M', inputCost: 2.00, outputCost: 8.00 },
  { id: 'gpt-4.1-mini', provider: 'openai', label: 'GPT-4.1 Mini', contextWindow: '1M', inputCost: 0.40, outputCost: 1.60 },
  { id: 'gpt-4.1-nano', provider: 'openai', label: 'GPT-4.1 Nano', contextWindow: '1M', inputCost: 0.10, outputCost: 0.40 },
  { id: 'o3-mini', provider: 'openai', label: 'o3-mini', contextWindow: '200k', inputCost: 1.10, outputCost: 4.40 },
  // Anthropic
  { id: 'claude-sonnet-4-20250514', provider: 'anthropic', label: 'Claude Sonnet 4', contextWindow: '200k', inputCost: 3.00, outputCost: 15.00 },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5', contextWindow: '200k', inputCost: 0.80, outputCost: 4.00 },
  { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', label: 'Claude 3.5 Sonnet', contextWindow: '200k', inputCost: 3.00, outputCost: 15.00 },
  // Google
  { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash', contextWindow: '1M', inputCost: 0.15, outputCost: 0.60 },
  { id: 'gemini-2.5-pro', provider: 'google', label: 'Gemini 2.5 Pro', contextWindow: '1M', inputCost: 1.25, outputCost: 10.00 },
  { id: 'gemini-2.0-flash', provider: 'google', label: 'Gemini 2.0 Flash', contextWindow: '1M', inputCost: 0.10, outputCost: 0.40 },
];

export const DEFAULT_MODEL_ID = 'gpt-4o-mini';

/** Format cost per 1M tokens for display. e.g. "$0.15" or "$3.00" */
export function formatCost(costPer1M: number): string {
  return `$${costPer1M.toFixed(2)}`;
}
