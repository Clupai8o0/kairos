'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useUpdateTask, useDeleteTask, useDeleteTaskSeries, useCompleteTask, useTasks } from '@/lib/hooks/use-tasks';
import { useTags } from '@/lib/hooks/use-tags';
import { useWindowTemplates } from '@/lib/hooks/use-window-templates';
import type { Task } from '@/lib/hooks/types';

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskEditModal({ task, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState(String(task.priority));
  const [status, setStatus] = useState(task.status);
  const [durationMins, setDurationMins] = useState(task.durationMins ? String(task.durationMins) : '');
  const [bufferMins, setBufferMins] = useState(String(task.bufferMins ?? 15));
  const [deadline, setDeadline] = useState(task.deadline ? toLocal(task.deadline) : '');
  const [schedulable, setSchedulable] = useState(task.schedulable);
  const [timeLocked, setTimeLocked] = useState(task.timeLocked ?? false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(task.tags.map((t) => t.id)),
  );
  const [preferredTemplateId, setPreferredTemplateId] = useState<string | null>(task.preferredTemplateId);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(!!task.recurrenceRule);
  const [recurrenceFreq, setRecurrenceFreq] = useState<string>(
    (task.recurrenceRule as Record<string, unknown>)?.freq as string ?? 'daily'
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState<string>(
    String((task.recurrenceRule as Record<string, unknown>)?.interval ?? '1')
  );
  const [recurrenceMode, setRecurrenceMode] = useState<string>(
    (task.recurrenceRule as Record<string, unknown>)?.mode as string ?? 'fixed'
  );
  const [dependsOn, setDependsOn] = useState<Set<string>>(new Set(task.dependsOn));
  const [depSearch, setDepSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSeries = !!task.parentTaskId || !!task.recurrenceRule;

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteTaskSeries = useDeleteTaskSeries();
  const completeTask = useCompleteTask();
  const { data: allTags = [] } = useTags();
  const { data: templates = [] } = useWindowTemplates();
  const { data: allTasks = [] } = useTasks();

  const otherTasks = allTasks.filter((t) => t.id !== task.id);
  const depCandidates = depSearch
    ? otherTasks.filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase())).slice(0, 8)
    : [];
  const depTasksById = new Map(allTasks.map((t) => [t.id, t]));
  const isBlocked = [...dependsOn].some((id) => depTasksById.get(id)?.status !== 'done');

  function toggleDep(id: string) {
    setDependsOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDepSearch('');
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleComplete() {
    const p = completeTask.mutateAsync(task.id);
    toast.promise(p, { loading: 'Marking complete…', success: 'Task completed', error: (e) => e?.message ?? 'Failed' });
    p.then(onClose).catch(() => {});
  }

  function handleReopen() {
    const p = updateTask.mutateAsync({ id: task.id, status: 'pending' });
    toast.promise(p, { loading: 'Reopening…', success: 'Task reopened', error: (e) => e?.message ?? 'Failed' });
    p.then(() => setStatus('pending')).catch(() => {});
  }

  function handleSave() {
    const p = updateTask.mutateAsync({
      id: task.id,
      title: title.trim(),
      description: description.trim() || undefined,
      priority: Number(priority),
      status,
      durationMins: durationMins ? Number(durationMins) : undefined,
      bufferMins: Number(bufferMins),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      schedulable,
      timeLocked,
      tagIds: [...selectedTagIds],
      dependsOn: [...dependsOn],
      preferredTemplateId: preferredTemplateId || null,
      recurrenceRule: recurrenceEnabled
        ? { freq: recurrenceFreq, interval: Number(recurrenceInterval), mode: recurrenceMode }
        : null,
    });
    toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => e?.message ?? 'Failed' });
    p.then(onClose).catch(() => {});
  }

  function handleDelete() {
    const p = deleteTask.mutateAsync(task.id);
    toast.promise(p, { loading: 'Deleting…', success: 'Deleted', error: (e) => e?.message ?? 'Failed' });
    p.then(onClose).catch(() => {});
  }

  function handleDeleteSeries() {
    const p = deleteTaskSeries.mutateAsync(task.id);
    toast.promise(p, { loading: 'Deleting series…', success: 'Series deleted', error: (e) => e?.message ?? 'Failed' });
    p.then(onClose).catch(() => {});
  }

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" />
      {/* Centering layer — click outside to dismiss */}
      <div className="absolute inset-0 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          className="bg-surface-2 border border-wire rounded-lg shadow-xl w-full max-w-md"
          initial={{ scale: 0.97, y: 6 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.97, y: 6 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-wire">
            <h2 className="text-sm font-[510] text-fg">Edit task</h2>
            <button onClick={onClose} className="text-fg-3 hover:text-fg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
            <div>
              <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Title</label>
              <input
                className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Description</label>
              <textarea
                className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors resize-none"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Priority</label>
                <select
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="1">1 — Urgent</option>
                  <option value="2">2 — High</option>
                  <option value="3">3 — Normal</option>
                  <option value="4">4 — Low</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Status</label>
                <select
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Task['status'])}
                >
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Duration (min)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  placeholder="30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Buffer (min)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                  value={bufferMins}
                  onChange={(e) => setBufferMins(e.target.value)}
                  placeholder="15"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Deadline</label>
              <input
                type="datetime-local"
                className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={schedulable}
                  onClick={() => setSchedulable((s) => !s)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${schedulable ? 'bg-accent' : 'bg-surface-3'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-fg transition-transform ${schedulable ? 'translate-x-4' : ''}`}
                  />
                </button>
                <span className="text-sm text-fg-2">Auto-schedule</span>
              </div>
              {task.scheduledAt && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={timeLocked}
                    onClick={() => setTimeLocked((l) => !l)}
                    className={`relative w-8 h-4 rounded-full transition-colors ${timeLocked ? 'bg-warning' : 'bg-surface-3'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-fg transition-transform ${timeLocked ? 'translate-x-4' : ''}`}
                    />
                  </button>
                  <span className="text-sm text-fg-2">{timeLocked ? 'Time locked' : 'Time unlocked'}</span>
                </div>
              )}
            </div>

            {schedulable && templates.length > 0 && (
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Preferred template</label>
                <select
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={preferredTemplateId ?? ''}
                  onChange={(e) => setPreferredTemplateId(e.target.value || null)}
                >
                  <option value="">No preference</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
                  ))}
                </select>
                <p className="text-[10px] text-fg-4 mt-0.5">Task will prefer slots in this template&apos;s windows</p>
              </div>
            )}

            {schedulable && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recurrenceEnabled}
                    onClick={() => setRecurrenceEnabled((v) => !v)}
                    className={`relative w-8 h-4 rounded-full transition-colors ${recurrenceEnabled ? 'bg-accent' : 'bg-surface-3'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-fg transition-transform ${recurrenceEnabled ? 'translate-x-4' : ''}`} />
                  </button>
                  <span className="text-sm text-fg-2">Recurring</span>
                </div>

                {recurrenceEnabled && (
                  <div className="space-y-2 pl-0.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Mode</label>
                        <select
                          className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                          value={recurrenceMode}
                          onChange={(e) => setRecurrenceMode(e.target.value)}
                        >
                          <option value="fixed">Fixed schedule</option>
                          <option value="after-complete">After completion</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Frequency</label>
                        <select
                          className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                          value={recurrenceFreq}
                          onChange={(e) => setRecurrenceFreq(e.target.value)}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">
                        {recurrenceMode === 'after-complete' ? 'Repeat every' : 'Every'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          className="w-20 bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(e.target.value)}
                        />
                        <span className="text-sm text-fg-3">
                          {recurrenceFreq === 'daily' ? 'day(s)' : recurrenceFreq === 'weekly' ? 'week(s)' : recurrenceFreq === 'monthly' ? 'month(s)' : 'year(s)'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-fg-4">
                      {recurrenceMode === 'after-complete'
                        ? 'Next occurrence scheduled relative to when you complete this one'
                        : 'Occurrences scheduled on fixed calendar dates'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {allTags.length > 0 && (
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-[510] border transition-colors ${
                          active
                            ? 'text-fg border-transparent'
                            : 'bg-surface border-wire text-fg-3 hover:text-fg hover:border-wire-2'
                        }`}
                        style={active ? { backgroundColor: tag.color ?? 'var(--color-accent)' } : undefined}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dependencies */}
            <div>
              <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1.5">Depends on</label>
              {dependsOn.size > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {[...dependsOn].map((id) => {
                    const dep = depTasksById.get(id);
                    if (!dep) return null;
                    const done = dep.status === 'done';
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleDep(id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-[510] border transition-colors ${done ? 'border-success/40 text-success' : 'border-warning/40 text-warning'}`}
                      >
                        {done ? '✓' : '○'} {dep.title}
                        <span className="text-fg-4 ml-0.5">×</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                placeholder="Search tasks to link…"
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
              />
              {depCandidates.length > 0 && (
                <div className="mt-1 border border-wire rounded bg-surface overflow-hidden">
                  {depCandidates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleDep(t.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-fg-2 hover:bg-ghost text-left transition-colors"
                    >
                      <span className={`w-3 h-3 rounded-full border shrink-0 flex items-center justify-center ${dependsOn.has(t.id) ? 'bg-accent border-accent' : 'border-wire-2'}`}>
                        {dependsOn.has(t.id) && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
                      </span>
                      <span className="truncate">{t.title}</span>
                      {t.status === 'done' && <span className="ml-auto text-[10px] text-success shrink-0">done</span>}
                    </button>
                  ))}
                </div>
              )}
              {isBlocked && (
                <p className="text-[11px] text-warning mt-1.5">Blocked — complete prerequisites first to mark this done.</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-wire">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="text-xs font-[510] text-danger border border-danger/40 hover:border-danger px-2 py-0.5 rounded transition-colors"
                >
                  {isSeries ? 'This one' : 'Confirm'}
                </button>
                {isSeries && (
                  <button
                    onClick={handleDeleteSeries}
                    className="text-xs font-[510] text-danger border border-danger/40 hover:border-danger px-2 py-0.5 rounded transition-colors"
                  >
                    Whole series
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-fg-3 hover:text-fg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-fg-4 hover:text-danger transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex items-center gap-2">
              {status !== 'done' ? (
                <button
                  onClick={handleComplete}
                  disabled={completeTask.isPending || isBlocked}
                  title={isBlocked ? 'Complete prerequisites first' : undefined}
                  className="text-xs font-[510] text-fg-3 hover:text-success border border-wire hover:border-success/50 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Complete
                </button>
              ) : (
                <button
                  onClick={handleReopen}
                  disabled={updateTask.isPending}
                  className="text-xs font-[510] text-success border border-success/40 hover:border-success px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Completed
                </button>
              )}
              <button
                onClick={onClose}
                className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-3 py-1.5 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || updateTask.isPending}
                className="text-xs font-[510] text-fg bg-accent hover:bg-accent-hover disabled:opacity-40 px-3 py-1.5 rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
