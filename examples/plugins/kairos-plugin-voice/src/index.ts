import { definePlugin, createParseResult } from '@kairos/plugin-sdk';
import { z } from 'zod';
import type { ScratchpadInput, PluginContext } from '@kairos/plugin-sdk';

const ExtractedSchema = z.object({
  transcript: z.string().optional(),
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
  name: 'kairos-plugin-voice',
  version: '1.0.0',
  displayName: 'Voice Memo',
  description: 'Transcribes voice memos and extracts action items.',
  author: 'Kairos',
  handlesInputTypes: ['voice'] as const,

  canHandle(input: ScratchpadInput): boolean {
    return input.inputType === 'voice';
  },

  async parse(input: ScratchpadInput, ctx: PluginContext) {
    ctx.log('info', 'Processing voice memo');

    // input.content is either:
    // - a pre-transcribed text string (if the client did STT), or
    // - a data URL / base64 blob that needs server-side transcription
    const isTranscription = !input.content.startsWith('data:');
    const transcript = isTranscription
      ? input.content
      : await transcribeAudio(input.content, ctx);

    const prompt = `Extract actionable tasks from this voice memo transcript.
Return a JSON object with a "tasks" array. Each task:
- title: clear action starting with a verb
- description: optional context from the memo
- tags: relevant labels
- priority: 1=urgent, 2=high, 3=normal, 4=low
- durationMins: estimated time if mentioned

Voice memo transcript:
${transcript}`;

    const extracted = await ctx.completeStructured(prompt, ExtractedSchema);

    return createParseResult({
      pluginName: 'kairos-plugin-voice',
      pluginVersion: '1.0.0',
      tasks: extracted.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        durationMins: t.durationMins ?? null,
        tags: [...t.tags, 'voice-memo'],
        sourceMetadata: { transcript },
      })),
      warnings: extracted.warnings,
    });
  },
});

async function transcribeAudio(audioDataUrl: string, ctx: PluginContext): Promise<string> {
  // Production: use Whisper API, AssemblyAI, or any STT service.
  // The audio data URL format: data:audio/webm;base64,<data>
  // For demo purposes, we return a placeholder.
  ctx.log('warn', 'Audio transcription not configured — returning placeholder');
  return `[Transcription of audio memo — integrate a STT provider (e.g. OpenAI Whisper) in transcribeAudio() to populate this field. Audio length: ${Math.round(audioDataUrl.length / 1024)}KB]`;
}
