'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useUpdateTask, useDeleteTask } from '@/lib/hooks/use-tasks';
import { useTags } from '@/lib/hooks/use-tags';
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
  const [deadline, setDeadline] = useState(task.deadline ? toLocal(task.deadline) : '');
  const [schedulable, setSchedulable] = useState(task.schedulable);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(task.tags.map((t) => t.id)),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: allTags = [] } = useTags();

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    const p = updateTask.mutateAsync({
      id: task.id,
      title: title.trim(),
      description: description.trim() || undefined,
      priority: Number(priority),
      status,
      durationMins: durationMins ? Number(durationMins) : undefined,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      schedulable,
      tagIds: [...selectedTagIds],
    });
    toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => e?.message ?? 'Failed' });
    p.then(onClose).catch(() => {});
  }

  function handleDelete() {
    const p = deleteTask.mutateAsync(task.id);
    toast.promise(p, { loading: 'Deleting…', success: 'Deleted', error: (e) => e?.message ?? 'Failed' });
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
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

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
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-wire">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger">Delete this task?</span>
                <button
                  onClick={handleDelete}
                  className="text-xs font-[510] text-danger border border-danger/40 hover:border-danger px-2 py-0.5 rounded transition-colors"
                >
                  Confirm
                </button>
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
