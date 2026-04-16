import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { z } from 'zod';

type Provider = 'openai' | 'anthropic' | 'ollama';

function resolveModel() {
  const provider = (process.env.LLM_PROVIDER ?? 'openai') as Provider;
  const modelId =
    process.env.LLM_MODEL ??
    (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini');

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    return anthropic(modelId);
  }

  // openai or ollama (ollama is OpenAI-compatible)
  const openai = createOpenAI({
    apiKey: provider === 'ollama' ? 'ollama' : process.env.OPENAI_API_KEY!,
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
