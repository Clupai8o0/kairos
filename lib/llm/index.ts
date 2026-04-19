import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { z } from 'zod';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

/** All models available per provider */
export const MODEL_CATALOG: Record<string, { provider: LLMProvider; label: string; contextWindow: string }> = {
  // OpenAI
  'gpt-4o': { provider: 'openai', label: 'GPT-4o', contextWindow: '128k' },
  'gpt-4o-mini': { provider: 'openai', label: 'GPT-4o Mini', contextWindow: '128k' },
  'gpt-4.1': { provider: 'openai', label: 'GPT-4.1', contextWindow: '1M' },
  'gpt-4.1-mini': { provider: 'openai', label: 'GPT-4.1 Mini', contextWindow: '1M' },
  'gpt-4.1-nano': { provider: 'openai', label: 'GPT-4.1 Nano', contextWindow: '1M' },
  'o3-mini': { provider: 'openai', label: 'o3-mini', contextWindow: '200k' },
  // Anthropic
  'claude-sonnet-4-20250514': { provider: 'anthropic', label: 'Claude Sonnet 4', contextWindow: '200k' },
  'claude-haiku-4-5-20251001': { provider: 'anthropic', label: 'Claude Haiku 4.5', contextWindow: '200k' },
  'claude-3-5-sonnet-20241022': { provider: 'anthropic', label: 'Claude 3.5 Sonnet', contextWindow: '200k' },
  // Google
  'gemini-2.5-flash': { provider: 'google', label: 'Gemini 2.5 Flash', contextWindow: '1M' },
  'gemini-2.5-pro': { provider: 'google', label: 'Gemini 2.5 Pro', contextWindow: '1M' },
  'gemini-2.0-flash': { provider: 'google', label: 'Gemini 2.0 Flash', contextWindow: '1M' },
};

export function isLLMConfigured(): boolean {
  const provider = process.env.LLM_PROVIDER ?? 'openai';
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'google') return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (provider === 'ollama') return true;
  return !!process.env.OPENAI_API_KEY;
}

/** Check if a given provider has a usable key (env or user-provided) */
export function hasKeyForProvider(provider: LLMProvider, userApiKey?: string | null): boolean {
  if (userApiKey) return true;
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'google') return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (provider === 'ollama') return true;
  return false;
}

interface ResolveModelOpts {
  modelId?: string;
  apiKey?: string | null;
}

export function resolveModel(opts?: ResolveModelOpts) {
  const requestedModelId = opts?.modelId;

  // If a specific model was requested and exists in catalog, use it
  if (requestedModelId && MODEL_CATALOG[requestedModelId]) {
    const entry = MODEL_CATALOG[requestedModelId];
    return createProviderModel(entry.provider, requestedModelId, opts?.apiKey);
  }

  // Fallback to env-configured model
  const provider = (process.env.LLM_PROVIDER ?? 'openai') as LLMProvider;
  const modelId =
    process.env.LLM_MODEL ??
    (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : provider === 'google' ? 'gemini-2.0-flash' : 'gpt-4o-mini');

  return createProviderModel(provider, modelId, opts?.apiKey);
}

function createProviderModel(provider: LLMProvider, modelId: string, userApiKey?: string | null) {
  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: userApiKey ?? process.env.ANTHROPIC_API_KEY! });
    return anthropic(modelId);
  }

  if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey: userApiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
    return google(modelId);
  }

  // openai or ollama
  const openai = createOpenAI({
    apiKey: provider === 'ollama' ? 'ollama' : (userApiKey ?? process.env.OPENAI_API_KEY!),
    baseURL:
      provider === 'ollama'
        ? (process.env.OLLAMA_URL ?? 'http://localhost:11434/v1')
        : undefined,
  });
  return openai(modelId);
}

export async function complete(prompt: string): Promise<string> {
  const model = resolveModel();
  const { text } = await generateText({ model, prompt });
  return text;
}

export async function completeStructured<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const model = resolveModel();
  const { object } = await generateObject({ model, prompt, schema });
  return object;
}
