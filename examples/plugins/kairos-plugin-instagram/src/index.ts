import { definePlugin, createParseResult } from '@kairos/plugin-sdk';
import { z } from 'zod';
import type { ScratchpadInput, PluginContext } from '@kairos/plugin-sdk';

const INSTAGRAM_PATTERN = /instagram\.com\/(p|reel|tv)\//i;

const ExtractedSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
      priority: z.number().int().min(1).max(4).default(3),
    }),
  ),
  warnings: z.array(z.string()).default([]),
});

async function fetchPostText(url: string): Promise<string> {
  // In production, use a headless browser or Instagram Basic Display API.
  // This example uses a simple fetch for demonstration.
  // Instagram blocks direct fetches — real implementations need a proper scraping solution.
  return `Instagram post at ${url} — caption and metadata would be extracted here.`;
}

export default definePlugin({
  name: 'kairos-plugin-instagram',
  version: '1.0.0',
  displayName: 'Instagram',
  description: 'Extracts actionable tasks from Instagram posts and reels.',
  author: 'Kairos',
  handlesInputTypes: ['url'] as const,

  canHandle(input: ScratchpadInput): boolean {
    return input.inputType === 'url' && INSTAGRAM_PATTERN.test(input.content);
  },

  async parse(input: ScratchpadInput, ctx: PluginContext) {
    ctx.log('info', 'Processing Instagram URL', { url: input.content });

    const postText = await fetchPostText(input.content);

    const prompt = `Extract actionable tasks from this Instagram post content.
Return a JSON object with a "tasks" array. Each task should have:
- title: clear action starting with a verb
- description: optional context
- tags: relevant labels (e.g., "health", "shopping", "learning")
- priority: 1=urgent, 2=high, 3=normal, 4=low

Post content:
${postText}

Only extract genuinely actionable items. Ignore promotional content.`;

    const extracted = await ctx.completeStructured(prompt, ExtractedSchema);

    return createParseResult({
      pluginName: 'kairos-plugin-instagram',
      pluginVersion: '1.0.0',
      tasks: extracted.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        tags: [...t.tags, 'instagram'],
        sourceMetadata: { url: input.content },
      })),
      warnings: extracted.warnings,
    });
  },
});
