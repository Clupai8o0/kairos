// lib/chat/stream.ts — StreamText wrapper using lib/llm's resolveModel
import { streamText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
import { resolveModel } from '@/lib/llm';

const SYSTEM_PROMPT = `You are Kairos, an AI scheduling assistant. You help users manage tasks, schedule, and organize their time.

You have access to tools for managing tasks, tags, and scheduling. Use them when the user asks to create, update, delete, or query their tasks and schedule.

Be concise and helpful. When you create or modify tasks, confirm what you did.`;

export function createChatStream(
  messages: ModelMessage[],
  tools: ToolSet,
) {
  const model = resolveModel();
  return streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });
}
