// lib/chat/stream.ts — StreamText wrapper using lib/llm's resolveModel
import { streamText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
import { resolveModel } from '@/lib/llm';

const BASE_PROMPT = `You are Kairos, an AI scheduling assistant. You help users manage tasks, schedule, and organize their time.

You have access to tools for managing tasks, tags, and scheduling. Use them when the user asks to create, update, delete, or query their tasks and schedule.

When creating or updating tasks, use sensible defaults for any fields the user does not specify. Never ask the user for optional details like priority, duration, buffer, splittability, or deadline — just use the defaults and act immediately. Only ask clarifying questions when the request is genuinely ambiguous (e.g. which of several tasks to delete).

IMPORTANT: When looking for a task by name to update or delete it, always call listTasks WITHOUT any status filter first. Tasks can be in any status (pending, scheduled, in_progress, etc.). Do not assume a status. Match task titles using substring/fuzzy matching — the user may not type the exact full title.

When calling updateTask, deleteTask, or completeTask, always include the taskName field with the task's title so the user sees a human-readable confirmation.

Be concise and helpful. When you create or modify tasks, confirm what you did.`;

function buildSystemPrompt(timezone?: string): string {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date().toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${BASE_PROMPT}\n\nCurrent date and time: ${now} (${tz}). Use this when the user says "today", "tomorrow", "next Monday", etc.`;
}

export function createChatStream(
  messages: ModelMessage[],
  tools: ToolSet,
  opts?: { timezone?: string; modelId?: string; apiKey?: string | null },
) {
  const model = resolveModel({ modelId: opts?.modelId, apiKey: opts?.apiKey });
  return streamText({
    model,
    system: buildSystemPrompt(opts?.timezone),
    messages,
    tools,
    stopWhen: stepCountIs(10),
  });
}
