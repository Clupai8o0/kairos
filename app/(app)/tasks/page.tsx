'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/lib/hooks/use-tasks';
import { useTags } from '@/lib/hooks/use-tags';
import type { Task, TaskStatus } from '@/lib/hooks/types';

// ── Schema ─────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(4),
  deadline: z.string().optional(),
  schedulable: z.boolean(),
  durationMins: z.number().int().positive().optional(),
  tagIds: z.array(z.string()),
});

type TaskFormValues = z.infer<typeof taskSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_LABEL = ['', 'Urgent', 'High', 'Normal', 'Low'] as const;
const PRIORITY_COLOR = ['', 'text-red-400', 'text-orange-400', 'text-fg-3', 'text-fg-4'] as const;

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'done', label: 'Done' },
];

const STATUS_ICON: Record<TaskStatus, string> = {
  pending: '○',
  scheduled: '◉',
  in_progress: '●',
  done: '✓',
  cancelled: '✗',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: 'text-fg-4',
  scheduled: 'text-accent',
  in_progress: 'text-success',
  done: 'text-emerald',
  cancelled: 'text-fg-4',
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: formatShort(d), overdue: true };
  if (days === 0) return { label: 'Today', overdue: false };
  if (days === 1) return { label: 'Tomorrow', overdue: false };
  return { label: formatShort(d), overdue: false };
}

function formatShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Create/Edit Modal ──────────────────────────────────────────────────────

function TaskModal({
  task,
  onClose,
}: {
  task?: Task;
  onClose: () => void;
}) {
  const { data: tags } = useTags();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description ?? '',
          priority: task.priority,
          deadline: task.deadline ? task.deadline.split('T')[0] : undefined,
          schedulable: task.schedulable,
          durationMins: task.durationMins ?? undefined,
          tagIds: task.tags.map((t) => t.id),
        }
      : {
          priority: 3,
          schedulable: true,
          tagIds: [],
        },
  });

  const schedulable = form.watch('schedulable');
  const selectedTagIds = form.watch('tagIds');

  async function onSubmit(values: TaskFormValues) {
    const deadline = values.deadline
      ? new Date(values.deadline).toISOString()
      : undefined;

    if (task) {
      await updateTask.mutateAsync({
        id: task.id,
        title: values.title,
        description: values.description,
        priority: values.priority,
        deadline: deadline ?? null,
        schedulable: values.schedulable,
        durationMins: values.durationMins,
        tagIds: values.tagIds,
      });
    } else {
      await createTask.mutateAsync({
        title: values.title,
        description: values.description,
        priority: values.priority,
        deadline,
        schedulable: values.schedulable,
        durationMins: values.durationMins,
        bufferMins: 15,
        isSplittable: false,
        dependsOn: [],
        tagIds: values.tagIds,
      });
    }
    onClose();
  }

  function toggleTag(id: string) {
    const current = form.getValues('tagIds');
    form.setValue(
      'tagIds',
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/[0.85] px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 4 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="bg-surface-2 border border-wire rounded-xl p-5 w-full max-w-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-fg text-sm font-[510] mb-4">
            {task ? 'Edit task' : 'New task'}
          </h2>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Title */}
            <div>
              <input
                {...form.register('title')}
                placeholder="Task title"
                autoFocus
                className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-wire focus:ring-1 focus:ring-accent/30"
              />
              {form.formState.errors.title && (
                <p className="text-red-400 text-xs mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <textarea
              {...form.register('description')}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-wire focus:ring-1 focus:ring-accent/30 resize-none"
            />

            {/* Priority + Deadline */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-4 text-[11px] font-[510] uppercase tracking-wide mb-1">Priority</label>
                <select
                  {...form.register('priority', { valueAsNumber: true })}
                  className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent/30"
                >
                  <option value={1}>Urgent</option>
                  <option value={2}>High</option>
                  <option value={3}>Normal</option>
                  <option value={4}>Low</option>
                </select>
              </div>
              <div>
                <label className="block text-fg-4 text-[11px] font-[510] uppercase tracking-wide mb-1">Deadline</label>
                <input
                  type="date"
                  {...form.register('deadline')}
                  className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
            </div>

            {/* Schedulable */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" {...form.register('schedulable')} className="accent-brand" />
              <span className="text-fg-2 text-sm">Auto-schedule this task</span>
            </label>

            {/* Duration (shown when schedulable) */}
            {schedulable && (
              <div>
                <label className="block text-fg-4 text-[11px] font-[510] uppercase tracking-wide mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  {...form.register('durationMins', { valueAsNumber: true })}
                  placeholder="e.g. 60"
                  min={1}
                  className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div>
                <label className="block text-fg-4 text-[11px] font-[510] uppercase tracking-wide mb-2">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={[
                          'text-xs font-[510] px-2.5 py-1 rounded-full border transition-colors',
                          active
                            ? 'border-transparent text-white'
                            : 'border-wire text-fg-3 hover:border-fg-4',
                        ].join(' ')}
                        style={
                          active && tag.color
                            ? { backgroundColor: tag.color, borderColor: tag.color }
                            : tag.color
                            ? { color: tag.color, borderColor: tag.color + '40' }
                            : {}
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-fg-3 hover:text-fg-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 bg-brand hover:bg-accent text-white text-sm font-[510] rounded-md transition-colors disabled:opacity-50"
              >
                {isPending ? 'Saving…' : task ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  function markDone() {
    updateTask.mutate({ id: task.id, status: 'done' });
  }

  function markPending() {
    updateTask.mutate({ id: task.id, status: 'pending' });
  }

  const deadline = formatDate(task.deadline);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-wire-2 bg-ghost hover:bg-ghost-2 hover:border-wire transition-all"
    >
      {/* Status toggle */}
      <button
        onClick={task.status === 'done' ? markPending : markDone}
        className={`shrink-0 text-sm font-[510] w-5 text-center transition-colors ${STATUS_COLOR[task.status]} hover:text-accent`}
        title={task.status === 'done' ? 'Mark pending' : 'Mark done'}
      >
        {STATUS_ICON[task.status]}
      </button>

      {/* Title */}
      <span
        className={`flex-1 text-sm truncate ${task.status === 'done' || task.status === 'cancelled' ? 'line-through text-fg-4' : 'text-fg-2'}`}
      >
        {task.title}
      </span>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
        {task.tags.map((tag) => (
          <span
            key={tag.id}
            className="text-[11px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full"
            style={tag.color ? { color: tag.color, borderColor: tag.color + '40' } : {}}
          >
            {tag.name}
          </span>
        ))}

        {task.priority <= 2 && (
          <span className={`text-[11px] font-[510] ${PRIORITY_COLOR[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}

        {deadline && (
          <span className={`text-xs ${deadline.overdue ? 'text-red-400' : 'text-fg-4'}`}>
            {deadline.label}
          </span>
        )}
      </div>

      {/* Actions (hover) */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="p-1 text-fg-4 hover:text-fg-2 transition-colors"
          title="Edit"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
            <path d="M17.5 3.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z" />
          </svg>
        </button>
        <button
          onClick={() => deleteTask.mutate(task.id)}
          className="p-1 text-fg-4 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </motion.li>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [modalTask, setModalTask] = useState<Task | null | 'new'>(null);

  const { data: tasks, isLoading, error } = useTasks(
    statusFilter !== 'all' ? { status: statusFilter } : undefined,
  );

  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center justify-between">
        <h1 className="text-fg text-sm font-[510]">
          Tasks
          {pendingCount > 0 && (
            <span className="ml-2 text-fg-4 font-normal">{pendingCount} pending</span>
          )}
        </h1>
        <button
          onClick={() => setModalTask('new')}
          className="flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-[13px] font-[510] px-3 py-1.5 rounded-md transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New task
        </button>
      </header>

      <div className="px-6 py-4">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={[
                'px-3 py-1 rounded-md text-[13px] font-[510] transition-colors',
                statusFilter === tab.value
                  ? 'bg-ghost-3 text-fg'
                  : 'text-fg-4 hover:text-fg-3 hover:bg-ghost-2',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {error ? (
          <p className="text-red-400 text-sm">Failed to load tasks.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 bg-ghost rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tasks && tasks.length > 0 ? (
          <AnimatePresence mode="popLayout">
            <ul className="space-y-1">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={setModalTask} />
              ))}
            </ul>
          </AnimatePresence>
        ) : (
          <div className="text-center py-16">
            <p className="text-fg-4 text-sm mb-3">No tasks here.</p>
            <button
              onClick={() => setModalTask('new')}
              className="text-accent text-sm hover:text-accent-2 transition-colors"
            >
              Create your first task →
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalTask !== null && (
        <TaskModal
          task={modalTask !== 'new' ? modalTask : undefined}
          onClose={() => setModalTask(null)}
        />
      )}
    </div>
  );
}
