'use client';

import type { ToolUIPart } from 'ai';

interface ToolCallBlockProps {
  toolPart: ToolUIPart;
}

function summariseResult(toolName: string, result: unknown): string {
  if (result == null) return `${toolName} done`;

  const r = result as Record<string, unknown>;

  switch (toolName) {
    case 'createTask':
      return `Created: ${r.title ?? 'task'}`;
    case 'deleteTask':
      return 'Deleted task';
    case 'completeTask':
      return `Completed: ${r.title ?? 'task'}`;
    case 'listTasks': {
      const items = Array.isArray(result) ? result : [];
      return `Found ${items.length} task${items.length === 1 ? '' : 's'}`;
    }
    case 'listTags': {
      const items = Array.isArray(result) ? result : [];
      return `Found ${items.length} tag${items.length === 1 ? '' : 's'}`;
    }
    case 'runSchedule':
      return 'Schedule run enqueued';
    case 'createTag':
      return `Created tag: ${r.name ?? 'tag'}`;
    default:
      return `${toolName} done`;
  }
}

export function ToolCallBlock({ toolPart }: ToolCallBlockProps) {
  // ToolUIPart type is `tool-${toolName}` — extract the tool name
  const toolName = toolPart.type.replace(/^tool-/, '');
  const { state } = toolPart;

  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-3 bg-surface-3 rounded-full px-2 py-0.5 text-[11px] font-[510] shrink-0">
        {toolName}
      </span>

      {(state === 'input-available' || state === 'input-streaming') && (
        <span className="flex items-center gap-1 text-fg-4 text-[11px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg-4 animate-pulse" />
          {state === 'input-streaming' ? 'thinking…' : 'running…'}
        </span>
      )}

      {state === 'output-available' && (
        <span className="text-fg-3 text-[11px]">
          {summariseResult(toolName, toolPart.output)}
        </span>
      )}

      {state === 'output-error' && (
        <span className="text-danger text-[11px]">
          Error: {toolPart.errorText}
        </span>
      )}
    </div>
  );
}
