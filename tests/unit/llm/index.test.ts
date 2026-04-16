import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'hello' }),
  generateObject: vi.fn().mockResolvedValue({ object: { name: 'test' } }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => 'mock-openai-model')),
}));

import { complete, completeStructured } from '@/lib/llm';
import { z } from 'zod';

describe('complete', () => {
  it('returns generated text', async () => {
    const result = await complete('Say hello');
    expect(result).toBe('hello');
  });
});

describe('completeStructured', () => {
  it('returns validated object', async () => {
    const schema = z.object({ name: z.string() });
    const result = await completeStructured('Extract name', schema);
    expect(result).toEqual({ name: 'test' });
  });
});
