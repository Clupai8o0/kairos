import { definePlugin, createParseResult } from '@kairos/plugin-sdk';
import { z } from 'zod';
import type { ScratchpadInput, PluginContext } from '@kairos/plugin-sdk';

// Readwise exports typically look like:
// === Book Title by Author ===
// Highlight: "..."
// Note: ...
const READWISE_PATTERN = /^={3,}\s+.+\s+={3,}/m;

const ExtractedSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
      priority: z.number().int().min(1).max(4).default(3),
      durationMins: z.number().int().optional(),
    }),
  ),
  warnings: z.array(z.string()).default([]),
});

export default definePlugin({
  name: 'kairos-plugin-readwise',
  version: '1.0.0',
  displayName: 'Readwise',
  description: 'Converts Readwise highlight exports into reading and action tasks.',
  author: 'Kairos',
  handlesInputTypes: ['text'] as const,

  canHandle(input: ScratchpadInput): boolean {
    return input.inputType === 'text' && READWISE_PATTERN.test(input.content);
  },

  async parse(input: ScratchpadInput, ctx: PluginContext) {
    ctx.log('info', 'Processing Readwise highlights', { length: input.content.length });

    const prompt = `Convert these Readwise highlights into actionable learning tasks.
For each highlight, create a task to revisit, apply, or explore the concept.
Return a JSON object with a "tasks" array. Each task:
- title: action starting with a verb (e.g. "Research X", "Apply Y to Z", "Read more about W")
- description: the original highlight or note for context
- tags: topic labels (e.g. "reading", "learning", "book-notes")
- priority: 3 (normal) unless the note explicitly marks urgency
- durationMins: estimated time (default 30 for research tasks, 60 for deeper dives)

Highlights:
${input.content}`;

    const extracted = await ctx.completeStructured(prompt, ExtractedSchema);

    return createParseResult({
      pluginName: 'kairos-plugin-readwise',
      pluginVersion: '1.0.0',
      tasks: extracted.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        durationMins: t.durationMins ?? 30,
        tags: [...t.tags, 'readwise'],
        sourceMetadata: { source: 'readwise' },
      })),
      warnings: extracted.warnings,
    });
  },
});
