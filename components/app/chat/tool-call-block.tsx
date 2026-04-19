'use client';

import type { ToolUIPart } from 'ai';

interface ToolCallBlockProps {
  toolPart: ToolUIPart;
  onApprovalResponse?: (approvalId: string, approved: boolean) => void;
}

const PRIORITY_LABELS: Record<number, string> = { 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };
const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-danger',
  2: 'text-warning',
  3: 'text-fg-3',
  4: 'text-fg-4',
};

const TOOL_ICONS: Record<string, string> = {
  createTask: '＋',
  bulkCreateTasks: '＋＋',
  updateTask: '✎',
  deleteTask: '✕',
  completeTask: '✓',
  listTasks: '☰',
  listTags: '⁕',
  createTag: '#',
  listSchedule: '▦',
  runSchedule: '▶',
};

const TOOL_LABELS: Record<string, string> = {
  createTask: 'Create Task',
  bulkCreateTasks: 'Bulk Create',
  updateTask: 'Update Task',
  deleteTask: 'Delete Task',
  completeTask: 'Complete Task',
  listTasks: 'List Tasks',
  listTags: 'List Tags',
  createTag: 'Create Tag',
  listSchedule: 'Schedule',
  runSchedule: 'Run Schedule',
};

// ── Detail builders ──────────────────────────────────────────────────────

type Detail = { label: string; value: string; color?: string };

function getActionDetails(toolName: string, input: unknown): { title: string; details: Detail[] } {
  const args = input as Record<string, unknown>;

  switch (toolName) {
    case 'createTask': {
      const details: Detail[] = [];
      if (args.priority && (args.priority as number) !== 3)
        details.push({ label: 'Priority', value: PRIORITY_LABELS[args.priority as number] ?? String(args.priority), color: PRIORITY_COLORS[args.priority as number] });
      if (args.durationMins) details.push({ label: 'Duration', value: `${args.durationMins} min` });
      if (args.deadline) details.push({ label: 'Deadline', value: new Date(args.deadline as string).toLocaleDateString() });
      if (args.tags && (args.tags as string[]).length > 0) details.push({ label: 'Tags', value: (args.tags as string[]).join(', ') });
      if (args.schedulable === false) details.push({ label: 'Schedulable', value: 'No' });
      if (args.isSplittable) details.push({ label: 'Splittable', value: 'Yes' });
      return { title: String(args.title ?? 'Untitled'), details };
    }

    case 'bulkCreateTasks': {
      const tasks = (args.tasks as Array<{ title?: string }>) ?? [];
      const titles = tasks.map((t) => t.title ?? '?');
      return {
        title: `${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
        details: titles.map((t, i) => ({ label: `#${i + 1}`, value: t })),
      };
    }

    case 'updateTask': {
      const name = (args.taskName as string) ?? (args.title as string) ?? 'Task';
      const details: Detail[] = [];
      if (args.title) details.push({ label: 'Rename', value: String(args.title) });
      if (args.priority) details.push({ label: 'Priority', value: PRIORITY_LABELS[args.priority as number] ?? String(args.priority), color: PRIORITY_COLORS[args.priority as number] });
      if (args.deadline) details.push({ label: 'Deadline', value: new Date(args.deadline as string).toLocaleDateString() });
      if (args.deadline === null) details.push({ label: 'Deadline', value: 'Remove' });
      if (args.status) details.push({ label: 'Status', value: String(args.status) });
      if (args.tags) details.push({ label: 'Tags', value: (args.tags as string[]).join(', ') });
      if (args.durationMins) details.push({ label: 'Duration', value: `${args.durationMins} min` });
      return { title: name, details };
    }

    case 'deleteTask':
      return { title: (args.taskName as string) ?? 'Task', details: [] };

    case 'completeTask':
      return { title: (args.taskName as string) ?? 'Task', details: [] };

    default:
      return { title: toolName, details: [] };
  }
}

function getResultSummary(toolName: string, result: unknown): { title: string; subtitle?: string; variant: 'success' | 'warning' | 'error' | 'neutral' } {
  if (result == null) return { title: 'Done', variant: 'success' };
  const r = result as Record<string, unknown>;

  switch (toolName) {
    case 'createTask':
      if (r.duplicate)
        return { title: `"${(r.existingTask as Record<string, unknown>)?.title}" already exists`, subtitle: 'Confirm to create a duplicate', variant: 'warning' };
      return { title: `"${r.title}"`, subtitle: r.schedulable ? 'Queued for scheduling' : 'Not scheduled', variant: 'success' };
    case 'bulkCreateTasks': {
      const tasks = (r.tasks as Array<{ title?: string }>) ?? [];
      return { title: `${tasks.length} task${tasks.length === 1 ? '' : 's'} created`, subtitle: tasks.slice(0, 3).map((t) => t.title).join(', '), variant: 'success' };
    }
    case 'updateTask':
      return r.error ? { title: String(r.error), variant: 'error' } : { title: `"${r.title}" updated`, variant: 'success' };
    case 'deleteTask':
      return r.error ? { title: String(r.error), variant: 'error' } : { title: `"${r.title}" deleted`, variant: 'success' };
    case 'completeTask':
      return r.error ? { title: String(r.error), variant: 'error' } : { title: `"${r.title}" completed`, variant: 'success' };
    case 'listTasks': {
      const items = Array.isArray(result) ? result : [];
      return { title: `${items.length} task${items.length === 1 ? '' : 's'} found`, variant: 'neutral' };
    }
    case 'listTags': {
      const items = Array.isArray(result) ? result : [];
      return { title: `${items.length} tag${items.length === 1 ? '' : 's'} found`, variant: 'neutral' };
    }
    case 'runSchedule':
      return { title: 'Schedule run enqueued', variant: 'success' };
    case 'createTag':
      return { title: `Tag "${r.name}" created`, variant: 'success' };
    default:
      return { title: 'Done', variant: 'success' };
  }
}

const VARIANT_STYLES = {
  success: 'border-success/20 bg-success/5',
  warning: 'border-warning/20 bg-warning/5',
  error: 'border-danger/20 bg-danger/5',
  neutral: 'border-line bg-surface-2',
} as const;

const VARIANT_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
  neutral: 'bg-fg-4',
} as const;

// ── Component ────────────────────────────────────────────────────────────

export function ToolCallBlock({ toolPart, onApprovalResponse }: ToolCallBlockProps) {
  const toolName = toolPart.type.replace(/^tool-/, '');
  const { state } = toolPart;
  const icon = TOOL_ICONS[toolName] ?? '•';
  const label = TOOL_LABELS[toolName] ?? toolName;
  const isMutating = ['createTask', 'bulkCreateTasks', 'updateTask', 'deleteTask', 'completeTask'].includes(toolName);

  // Compact inline pill for read-only tools (list, schedule)
  if (!isMutating) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-fg-4 text-xs">{icon}</span>
        <span className="text-fg-3 text-xs font-medium">{label}</span>
        {(state === 'input-available' || state === 'input-streaming') && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg-4 animate-pulse" />
        )}
        {state === 'output-available' && (
          <span className="text-fg-4 text-xs">{getResultSummary(toolName, toolPart.output).title}</span>
        )}
        {state === 'output-error' && (
          <span className="text-danger text-xs">Error</span>
        )}
      </div>
    );
  }

  // Card view for mutating tools
  return (
    <div className="rounded-lg border border-line bg-surface-2 overflow-hidden my-1 max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line/50">
        <span className="text-fg-4 text-xs">{icon}</span>
        <span className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        {(state === 'input-available' || state === 'input-streaming') && (
          <span className="ml-auto inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
        {state === 'approval-responded' && !('output' in toolPart) && toolPart.approval.approved && (
          <span className="ml-auto inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
        {state === 'approval-responded' && !('output' in toolPart) && !toolPart.approval.approved && (
          <span className="ml-auto text-fg-4 text-[10px]">cancelled</span>
        )}
      </div>

      {/* Body — loading state */}
      {(state === 'input-available' || state === 'input-streaming') && (
        <div className="px-3 py-2.5">
          <div className="h-3 w-2/3 bg-surface-3 rounded animate-pulse" />
        </div>
      )}

      {/* Body — approval requested */}
      {state === 'approval-requested' && (() => {
        const { title, details } = getActionDetails(toolName, toolPart.input);
        return (
          <div className="px-3 py-2.5 space-y-2">
            <p className="text-fg text-sm font-medium">{title}</p>
            {details.length > 0 && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {details.map((d, i) => (
                  <div key={i} className="contents">
                    <span className="text-fg-4 text-[11px]">{d.label}</span>
                    <span className={`text-[11px] ${d.color ?? 'text-fg-2'}`}>{d.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onApprovalResponse?.(toolPart.approval.id, true)}
                className="text-xs font-medium px-3 py-1 rounded-md bg-brand text-white hover:bg-accent transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onApprovalResponse?.(toolPart.approval.id, false)}
                className="text-xs font-medium px-3 py-1 rounded-md bg-surface-3 text-fg-3 hover:text-fg-2 hover:bg-ghost-3 transition-colors"
              >
                Deny
              </button>
            </div>
          </div>
        );
      })()}

      {/* Body — approved, waiting for result */}
      {state === 'approval-responded' && !('output' in toolPart) && toolPart.approval.approved && (
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <p className="text-fg-4 text-xs">Running…</p>
          </div>
        </div>
      )}

      {/* Body — denied */}
      {state === 'approval-responded' && !('output' in toolPart) && !toolPart.approval.approved && (() => {
        const { title } = getActionDetails(toolName, toolPart.input);
        return (
          <div className="px-3 py-2.5 flex items-start gap-2 bg-surface-3/50">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-fg-4" />
            <div>
              <p className="text-fg-4 text-xs font-medium line-through">{title}</p>
              <p className="text-fg-4 text-[11px] mt-0.5">Denied by user</p>
            </div>
          </div>
        );
      })()}

      {/* Body — result */}
      {state === 'output-available' && (() => {
        const { title, subtitle, variant } = getResultSummary(toolName, toolPart.output);
        return (
          <div className={`px-3 py-2.5 flex items-start gap-2 ${VARIANT_STYLES[variant]}`}>
            <span className={`mt-1 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${VARIANT_DOT[variant]}`} />
            <div>
              <p className="text-fg-2 text-xs font-medium">{title}</p>
              {subtitle && <p className="text-fg-4 text-[11px] mt-0.5">{subtitle}</p>}
            </div>
          </div>
        );
      })()}

      {/* Body — error */}
      {state === 'output-error' && (
        <div className="px-3 py-2.5 bg-danger/5">
          <p className="text-danger text-xs">{toolPart.errorText}</p>
        </div>
      )}
    </div>
  );
}
