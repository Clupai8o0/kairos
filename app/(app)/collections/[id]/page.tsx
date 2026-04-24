'use client';
import { useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useCollection,
  useCollectionProgress,
  useCreatePhase,
  useDeletePhase,
  useAddTaskToCollection,
  useRemoveTaskFromCollection,
  useMoveTaskToPhase,
  useBulkScheduleCollection,
  useUpdateCollection,
} from '@/lib/hooks/use-collections';
import { useTasks, useUpdateTask } from '@/lib/hooks/use-tasks';
import { TaskEditModal } from '@/components/app/task-edit-modal';
import type { CollectionTaskEntry, CollectionPhase, Task, TaskStatus } from '@/lib/hooks/types';

type ViewMode = 'list' | 'board';

const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-fg-4/10 text-fg-4',
  scheduled: 'bg-brand/15 text-brand',
  in_progress: 'bg-emerald/15 text-emerald',
  done: 'bg-success/15 text-success',
  cancelled: 'bg-danger/15 text-danger',
  backlog: 'bg-fg-4/10 text-fg-4',
  blocked: 'bg-warning/15 text-warning',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
  backlog: 'Backlog',
  blocked: 'Blocked',
};

const ALL_STATUSES: TaskStatus[] = ['pending', 'scheduled', 'in_progress', 'done', 'cancelled', 'backlog', 'blocked'];
const BOARD_STATUSES: TaskStatus[] = ['backlog', 'pending', 'scheduled', 'in_progress', 'blocked', 'done', 'cancelled'];

function StatusChip({
  status,
  taskId,
  onStatusChange,
}: {
  status: TaskStatus;
  taskId: string;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <span
        className={`text-[10px] font-[510] px-1.5 py-0.5 rounded-full cursor-pointer select-none transition-opacity hover:opacity-80 ${STATUS_CHIP[status] ?? ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        {STATUS_LABEL[status] ?? status}
      </span>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute top-full left-0 mt-1 z-50 bg-surface border border-wire rounded-lg shadow-xl py-1 min-w-[130px]"
            >
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(taskId, s);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-ghost-2 transition-colors flex items-center gap-2 ${
                    s === status ? 'text-brand font-[510]' : 'text-fg-2'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CHIP[s]?.split(' ')[0] ?? ''}`} />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskRow({
  entry,
  phases,
  checked,
  onToggle,
  onOpen,
  onRemove,
  onMoveToPhase,
  onStatusChange,
}: {
  entry: CollectionTaskEntry;
  phases: CollectionPhase[];
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRemove: (taskId: string) => void;
  onMoveToPhase: (taskId: string, phaseId: string | null) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const t = entry.task;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 4 }}
      className={`group flex items-center gap-3 py-2 px-3 rounded-md hover:bg-ghost-2 transition-colors cursor-pointer ${checked ? 'bg-brand/5 ring-1 ring-brand/20' : ''}`}
      onClick={onOpen}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          checked ? 'bg-brand border-brand' : 'border-wire-2 group-hover:border-wire'
        }`}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5,5 4,7.5 8.5,2.5" />
          </svg>
        )}
      </div>

      <StatusChip status={t.status} taskId={t.id} onStatusChange={onStatusChange} />

      <span className="flex-1 text-fg text-[13px] min-w-0 truncate">{t.title}</span>
      {t.tags.length > 0 && (
        <span className="text-[11px] text-fg-4 shrink-0 hidden sm:block truncate max-w-[120px]">
          {t.tags.map((tg) => tg.name).join(', ')}
        </span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {phases.length > 0 && (
          <select
            value={entry.phaseId ?? ''}
            onChange={(e) => onMoveToPhase(t.id, e.target.value || null)}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] bg-surface-2 border border-wire rounded px-1.5 py-0.5 text-fg-3 outline-none"
          >
            <option value="">No phase</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
          className="p-1 rounded text-fg-4 hover:text-danger hover:bg-ghost-2 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </motion.div>
  );
}

function KanbanCard({
  entry,
  onOpen,
  onRemove,
  onStatusChange,
}: {
  entry: CollectionTaskEntry;
  onOpen: () => void;
  onRemove: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const t = entry.task;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="bg-surface border border-wire rounded-lg p-3 cursor-pointer hover:border-wire-2 hover:shadow-sm transition-all group"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-fg text-[12px] font-[500] leading-snug line-clamp-2 flex-1">{t.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-fg-4 hover:text-danger transition-all shrink-0"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusChip status={t.status} taskId={t.id} onStatusChange={onStatusChange} />
        {t.tags.map((tag) => (
          <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-ghost-2 text-fg-3">
            {tag.name}
          </span>
        ))}
        {t.deadline && (
          <span className="text-[10px] text-fg-4 ml-auto">
            {new Date(t.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function StatusColumn({
  status,
  tasks,
  onOpenTask,
  onRemoveTask,
  onStatusChange,
}: {
  status: TaskStatus;
  tasks: CollectionTaskEntry[];
  onOpenTask: (taskId: string) => void;
  onRemoveTask: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <div className="flex flex-col min-w-[220px] sm:min-w-[250px] max-w-[280px]">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`text-[10px] font-[510] px-2 py-0.5 rounded-full ${STATUS_CHIP[status] ?? ''}`}>
          {STATUS_LABEL[status]}
        </span>
        <span className="text-[11px] text-fg-4">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2 bg-surface-2 rounded-lg p-2 min-h-[80px]">
        <AnimatePresence mode="popLayout">
          {tasks.map((e) => (
            <KanbanCard
              key={e.taskId}
              entry={e}
              onOpen={() => onOpenTask(e.taskId)}
              onRemove={onRemoveTask}
              onStatusChange={onStatusChange}
            />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <p className="text-[11px] text-fg-4 text-center py-6">Empty</p>
        )}
      </div>
    </div>
  );
}

function BulkActionBar({
  count,
  onApplyStatus,
  onRemove,
  onClear,
}: {
  count: number;
  onApplyStatus: (status: TaskStatus) => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>('done');
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 bg-surface border border-wire rounded-lg shadow-xl"
    >
      <span className="text-[12px] text-fg-2 font-[510] shrink-0">{count} selected</span>
      <div className="w-px h-4 bg-wire" />
      <select
        value={bulkStatus}
        onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
        className="text-[12px] bg-surface-2 border border-wire rounded px-2 py-1 text-fg outline-none"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </select>
      <button
        onClick={() => onApplyStatus(bulkStatus)}
        className="px-2.5 py-1 text-[12px] font-[510] bg-brand text-white rounded hover:bg-brand/90 transition-colors"
      >
        Apply status
      </button>
      <div className="w-px h-4 bg-wire" />
      <button
        onClick={onRemove}
        className="px-2.5 py-1 text-[12px] font-[510] text-danger border border-danger/30 rounded hover:border-danger transition-colors"
      >
        Remove
      </button>
      <button
        onClick={onClear}
        className="p-1 text-fg-4 hover:text-fg transition-colors"
        title="Clear selection"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </motion.div>
  );
}

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: collection, isLoading } = useCollection(id);
  const { data: progress } = useCollectionProgress(id);
  const { data: allTasks } = useTasks();

  const createPhase = useCreatePhase();
  const deletePhase = useDeletePhase();
  const addTask = useAddTaskToCollection();
  const removeTask = useRemoveTaskFromCollection();
  const moveTask = useMoveTaskToPhase();
  const bulkSchedule = useBulkScheduleCollection();
  const updateCollection = useUpdateCollection();
  const updateTask = useUpdateTask();

  const [view, setView] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [addingPhase, setAddingPhase] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [searchTask, setSearchTask] = useState('');

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const openTask = useCallback(
    (taskId: string) => {
      const full = (allTasks ?? []).find((t) => t.id === taskId);
      if (full) setEditingTask(full);
    },
    [allTasks],
  );

  function handleStatusChange(taskId: string, status: TaskStatus) {
    const p = updateTask.mutateAsync({ id: taskId, status });
    toast.promise(p, {
      loading: 'Updating…',
      success: `Set to ${STATUS_LABEL[status]}`,
      error: (err) => err?.message ?? 'Failed',
    });
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="h-6 w-40 bg-ghost-2 rounded animate-pulse mb-4" />
        <div className="h-4 w-64 bg-ghost-2 rounded animate-pulse mb-8" />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-64 h-40 bg-ghost-2 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-3">
        Collection not found
      </div>
    );
  }

  const memberIds = new Set(collection.tasks.map((t) => t.taskId));
  const candidateTasks = (allTasks ?? []).filter(
    (t) => !memberIds.has(t.id) && t.title.toLowerCase().includes(searchTask.toLowerCase()),
  );

  const tasksByStatus = new Map<TaskStatus, CollectionTaskEntry[]>();
  for (const s of BOARD_STATUSES) tasksByStatus.set(s, []);
  for (const t of collection.tasks) {
    const list = tasksByStatus.get(t.task.status) ?? [];
    list.push(t);
    tasksByStatus.set(t.task.status, list);
  }

  async function handleAddPhase() {
    if (!newPhaseTitle.trim()) return;
    const p = createPhase.mutateAsync({ collectionId: id, title: newPhaseTitle.trim() });
    toast.promise(p, { loading: 'Adding phase…', success: 'Phase added', error: (err) => err?.message ?? 'Failed' });
    await p.catch(() => {});
    setNewPhaseTitle('');
    setAddingPhase(false);
  }

  async function handleDeletePhase(phaseId: string) {
    if (!confirm('Delete this phase? Tasks in it will become unassigned.')) return;
    const p = deletePhase.mutateAsync({ collectionId: id, phaseId });
    toast.promise(p, { loading: 'Deleting phase…', success: 'Phase deleted', error: (err) => err?.message ?? 'Failed' });
  }

  async function handleAddTask(taskId: string) {
    const p = addTask.mutateAsync({ collectionId: id, taskId });
    toast.promise(p, { loading: 'Adding…', success: 'Task added', error: (err) => err?.message ?? 'Already in collection or not found' });
    await p.catch(() => {});
    setSearchTask('');
    setAddingTask(false);
  }

  function handleRemoveTask(taskId: string) {
    if (!confirm('Remove task from this collection?')) return;
    const p = removeTask.mutateAsync({ collectionId: id, taskId });
    toast.promise(p, { loading: 'Removing…', success: 'Removed', error: (err) => err?.message ?? 'Failed' });
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
  }

  function handleMoveToPhase(taskId: string, phaseId: string | null) {
    moveTask.mutate({ collectionId: id, taskId, phaseId });
  }

  async function handleBulkSchedule() {
    const p = bulkSchedule.mutateAsync(id);
    toast.promise(p, {
      loading: 'Scheduling collection…',
      success: (r) => r.enqueued ? `Scheduling ${r.taskCount} tasks…` : (r.message ?? 'Nothing to schedule'),
      error: (err) => err?.message ?? 'Failed',
    });
  }

  async function handleArchive() {
    if (!collection) return;
    const newStatus = collection.status === 'archived' ? 'active' : 'archived';
    const p = updateCollection.mutateAsync({ id, status: newStatus });
    toast.promise(p, {
      loading: 'Updating…',
      success: newStatus === 'archived' ? 'Archived' : 'Unarchived',
      error: (err) => err?.message ?? 'Failed',
    });
  }

  async function handleBulkStatus(status: TaskStatus) {
    const ids = [...selectedIds];
    const promises = ids.map((taskId) => updateTask.mutateAsync({ id: taskId, status }));
    const p = Promise.all(promises);
    toast.promise(p, {
      loading: `Updating ${ids.length} tasks…`,
      success: `${ids.length} tasks set to ${STATUS_LABEL[status]}`,
      error: (err) => err?.message ?? 'Some updates failed',
    });
    await p.catch(() => {});
    setSelectedIds(new Set());
  }

  async function handleBulkRemove() {
    const ids = [...selectedIds];
    if (!confirm(`Remove ${ids.length} task${ids.length > 1 ? 's' : ''} from this collection?`)) return;
    const promises = ids.map((taskId) => removeTask.mutateAsync({ collectionId: id, taskId }));
    const p = Promise.all(promises);
    toast.promise(p, {
      loading: `Removing ${ids.length} tasks…`,
      success: 'Removed',
      error: (err) => err?.message ?? 'Some removals failed',
    });
    await p.catch(() => {});
    setSelectedIds(new Set());
  }

  function handleSelectAll() {
    if (selectedIds.size === collection!.tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(collection!.tasks.map((t) => t.taskId)));
    }
  }

  const deadline = collection.deadline ? new Date(collection.deadline) : null;
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const allSelected = collection.tasks.length > 0 && selectedIds.size === collection.tasks.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-wire-2 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push('/collections')} className="mt-0.5 text-fg-4 hover:text-fg-2 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {collection.color && (
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: collection.color }} />
              )}
              <h1 className="text-fg text-[16px] font-[510]">{collection.title}</h1>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-brand/15 text-brand">{collection.status}</span>
            </div>
            {collection.description && (
              <p className="text-fg-3 text-[12px] mt-0.5 line-clamp-1">{collection.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleBulkSchedule}
              disabled={bulkSchedule.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-[510] bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6l4-4 4 4M12 2v10.5M20 17.5A8 8 0 116 17.5" />
              </svg>
              Schedule
            </button>
            <button
              onClick={handleArchive}
              className="px-2.5 py-1.5 text-[12px] text-fg-3 hover:text-fg border border-wire rounded-md hover:border-wire-2 transition-colors"
            >
              {collection.status === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </div>

        {/* Progress */}
        {progress && progress.total > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-fg-4">
              <span>{progress.total} tasks · {progress.done} done</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1 rounded-full bg-ghost-2 overflow-hidden">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {deadline && (
                <span className={`text-[11px] ${deadline < new Date() && collection.status === 'active' ? 'text-danger' : 'text-fg-4'}`}>
                  Deadline: {deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {progress.blocked > 0 && <span className="text-[11px] text-warning">{progress.blocked} blocked</span>}
              {progress.backlog > 0 && <span className="text-[11px] text-fg-4">{progress.backlog} in backlog</span>}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-4 sm:px-6 py-3 border-b border-wire-2 flex items-center gap-2">
        <button
          onClick={() => setAddingTask(!addingTask)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-fg-3 hover:text-fg border border-wire rounded-md hover:border-wire-2 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add task
        </button>
        {view === 'list' && (
          <button
            onClick={() => setAddingPhase(!addingPhase)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-fg-3 hover:text-fg border border-wire rounded-md hover:border-wire-2 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add phase
          </button>
        )}

        <div className="flex-1" />

        {view === 'list' && collection.tasks.length > 0 && (
          <button
            onClick={handleSelectAll}
            className="text-[12px] text-fg-4 hover:text-fg transition-colors"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-ghost-2 rounded-md p-0.5">
          {(['list', 'board'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                view === v ? 'bg-surface text-fg shadow-sm' : 'text-fg-4 hover:text-fg'
              }`}
            >
              {v === 'list' ? 'List' : 'Board'}
            </button>
          ))}
        </div>
      </div>

      {/* Add task panel */}
      <AnimatePresence>
        {addingTask && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-wire-2"
          >
            <div className="px-4 sm:px-6 py-3 flex flex-col gap-2">
              <input
                autoFocus
                placeholder="Search tasks…"
                value={searchTask}
                onChange={(e) => setSearchTask(e.target.value)}
                className="w-full bg-surface-2 border border-wire rounded-md px-3 py-2 text-[13px] text-fg placeholder:text-fg-4 outline-none focus:border-brand transition-colors"
              />
              {searchTask.length > 0 && (
                <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                  {candidateTasks.slice(0, 20).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleAddTask(t.id)}
                      className="text-left px-3 py-1.5 rounded-md text-[13px] text-fg-2 hover:bg-ghost-2 transition-colors truncate"
                    >
                      {t.title}
                    </button>
                  ))}
                  {candidateTasks.length === 0 && (
                    <p className="text-[12px] text-fg-4 py-2 px-3">No matching tasks outside this collection</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add phase panel (list view only) */}
      <AnimatePresence>
        {addingPhase && view === 'list' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-wire-2"
          >
            <div className="px-4 sm:px-6 py-3 flex items-center gap-2">
              <input
                autoFocus
                placeholder="Phase name (e.g. Week 1, Sprint 2)"
                value={newPhaseTitle}
                onChange={(e) => setNewPhaseTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPhase()}
                className="flex-1 bg-surface-2 border border-wire rounded-md px-3 py-2 text-[13px] text-fg placeholder:text-fg-4 outline-none focus:border-brand transition-colors"
              />
              <button
                onClick={handleAddPhase}
                disabled={!newPhaseTitle.trim()}
                className="px-3 py-2 bg-brand text-white text-[13px] rounded-md hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setAddingPhase(false)}
                className="px-3 py-2 text-[13px] text-fg-3 hover:text-fg transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list / board */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6">
        {collection.tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-fg-3 text-[13px]">No tasks yet</p>
            <p className="text-fg-4 text-[12px]">Add tasks from your task list, or create new ones via chat.</p>
          </div>
        ) : view === 'list' ? (
          /* ── List view: grouped by phase if phases exist ──── */
          collection.phases.length > 0 ? (
            <div className="flex flex-col gap-6 w-full max-w-xl">
              {collection.phases.map((phase) => {
                const phaseTasks = collection.tasks.filter((t) => t.phaseId === phase.id);
                return (
                  <div key={phase.id}>
                    <div className="flex items-center justify-between mb-1 px-1">
                      <span className="text-[11px] font-[510] text-fg-3 uppercase tracking-wide">
                        {phase.title} <span className="text-fg-4 font-normal normal-case tracking-normal">({phaseTasks.length})</span>
                      </span>
                      <button
                        onClick={() => handleDeletePhase(phase.id)}
                        className="p-0.5 rounded text-fg-4 hover:text-danger transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <AnimatePresence mode="popLayout">
                        {phaseTasks.map((e) => (
                          <TaskRow
                            key={e.taskId}
                            entry={e}
                            phases={collection.phases}
                            checked={selectedIds.has(e.taskId)}
                            onToggle={() => toggleSelect(e.taskId)}
                            onOpen={() => openTask(e.taskId)}
                            onRemove={handleRemoveTask}
                            onMoveToPhase={handleMoveToPhase}
                            onStatusChange={handleStatusChange}
                          />
                        ))}
                      </AnimatePresence>
                      {phaseTasks.length === 0 && (
                        <p className="text-[11px] text-fg-4 px-3 py-2">No tasks in this phase</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Unassigned */}
              {collection.tasks.filter((t) => !t.phaseId).length > 0 && (
                <div>
                  <span className="text-[11px] font-[510] text-fg-4 uppercase tracking-wide px-1 block mb-1">
                    Unassigned
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <AnimatePresence mode="popLayout">
                      {collection.tasks.filter((t) => !t.phaseId).map((e) => (
                        <TaskRow
                          key={e.taskId}
                          entry={e}
                          phases={collection.phases}
                          checked={selectedIds.has(e.taskId)}
                          onToggle={() => toggleSelect(e.taskId)}
                          onOpen={() => openTask(e.taskId)}
                          onRemove={handleRemoveTask}
                          onMoveToPhase={handleMoveToPhase}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-xl flex flex-col gap-0.5">
              <AnimatePresence mode="popLayout">
                {collection.tasks.map((e) => (
                  <TaskRow
                    key={e.taskId}
                    entry={e}
                    phases={[]}
                    checked={selectedIds.has(e.taskId)}
                    onToggle={() => toggleSelect(e.taskId)}
                    onOpen={() => openTask(e.taskId)}
                    onRemove={handleRemoveTask}
                    onMoveToPhase={handleMoveToPhase}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </AnimatePresence>
            </div>
          )
        ) : (
          /* ── Board view: Kanban columns by status ────────── */
          <div className="flex gap-3 items-start">
            {BOARD_STATUSES.map((status) => {
              const colTasks = tasksByStatus.get(status) ?? [];
              if (colTasks.length === 0 && (status === 'cancelled' || status === 'blocked')) return null;
              return (
                <StatusColumn
                  key={status}
                  status={status}
                  tasks={colTasks}
                  onOpenTask={openTask}
                  onRemoveTask={handleRemoveTask}
                  onStatusChange={handleStatusChange}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            onApplyStatus={handleBulkStatus}
            onRemove={handleBulkRemove}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* Task edit modal */}
      <AnimatePresence>
        {editingTask && (
          <TaskEditModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
