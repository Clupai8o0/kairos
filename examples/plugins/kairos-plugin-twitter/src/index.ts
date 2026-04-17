import { definePlugin, createParseResult } from '@kairos/plugin-sdk';
import { z } from 'zod';
import type { ScratchpadInput, PluginContext } from '@kairos/plugin-sdk';

const TWITTER_PATTERN = /^https?:\/\/(twitter|x)\.com\/.+\/status\//i;

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

export default definePlugin({
  name: 'kairos-plugin-twitter',
  version: '1.0.0',
  displayName: 'Twitter / X',
  description: 'Extracts actionable tasks from tweets and threads.',
  author: 'Kairos',
  handlesInputTypes: ['url'] as const,

  canHandle(input: ScratchpadInput): boolean {
    return input.inputType === 'url' && TWITTER_PATTERN.test(input.content);
  },

  async parse(input: ScratchpadInput, ctx: PluginContext) {
    ctx.log('info', 'Processing Twitter/X URL', { url: input.content });

    // Use the nitter proxy or Twitter API v2 for production fetches.
    // payload.tweetText can be pre-populated by the client if a share extension is used.
    const tweetText = (input.payload['tweetText'] as string | undefined)
      ?? `Tweet at ${input.content} — text would be fetched via Twitter API v2 here.`;

    const prompt = `Extract actionable tasks from this tweet or thread.
Return a JSON object with a "tasks" array. Each task should have:
- title: clear action starting with a verb
- description: optional context
- tags: relevant labels
- priority: 1=urgent, 2=high, 3=normal, 4=low

Tweet content:
${tweetText}

Only extract clearly actionable items. Ignore retweet commentary and likes.`;

    const extracted = await ctx.completeStructured(prompt, ExtractedSchema);

    return createParseResult({
      pluginName: 'kairos-plugin-twitter',
      pluginVersion: '1.0.0',
      tasks: extracted.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        tags: [...t.tags, 'twitter'],
        sourceMetadata: { url: input.content },
      })),
      warnings: extracted.warnings,
    });
  },
});
