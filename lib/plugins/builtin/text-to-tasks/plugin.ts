import { z } from 'zod';
import { CandidateTaskSchema, ParseResultSchema } from '@/lib/plugins/types';
import type { ScratchpadPlugin, ScratchpadInput, ParseResult, CandidateTask, PluginContext } from '@/lib/plugins/types';
import { buildExtractionPrompt } from './prompts';

const ExtractionSchema = z.object({ tasks: z.array(CandidateTaskSchema) });

export class TextToTasksPlugin implements ScratchpadPlugin {
  name = 'text-to-tasks';
  version = '1.0.0';
  displayName = 'Text to Tasks';
  description = 'Extracts actionable tasks from plain text using your configured LLM.';
  author = 'Kairos';
  handlesInputTypes = ['text'] as const;

  canHandle(input: ScratchpadInput): boolean {
    return input.inputType === 'text';
  }

  async parse(input: ScratchpadInput, context: PluginContext): Promise<ParseResult> {
    const prompt = buildExtractionPrompt(input.content);
    const { tasks } = await context.completeStructured(prompt, ExtractionSchema);

    const rulesets = await context.getRulesets();
    const processed = applyRulesets(tasks, rulesets);

    context.log('info', 'Extracted tasks', { count: processed.length });

    return ParseResultSchema.parse({
      pluginName: this.name,
      pluginVersion: this.version,
      tasks: processed,
      rawOutput: { tasks },
      warnings: [],
    });
  }
}

function applyRulesets(tasks: CandidateTask[], rulesets: Array<Record<string, unknown>>): CandidateTask[] {
  if (rulesets.length === 0) return tasks;
  return tasks.map((task) => {
    let t = { ...task };
    for (const rule of rulesets) {
      const cond = rule.if as { contains?: string } | undefined;
      const action = rule.then as { tag?: string; durationMins?: number } | undefined;
      if (!cond || !action) continue;
      const text = `${t.title} ${t.description ?? ''}`.toLowerCase();
      if (cond.contains && text.includes(cond.contains.toLowerCase())) {
        if (action.tag && !t.tags.includes(action.tag)) t = { ...t, tags: [...t.tags, action.tag] };
        if (action.durationMins) t = { ...t, durationMins: action.durationMins };
      }
    }
    return t;
  });
}
