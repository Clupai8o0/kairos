'use client';
import { useState, use } from 'react';
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
import { useTasks } from '@/lib/hooks/use-tasks';
import type { CollectionTaskEntry, CollectionPhase } from '@/lib/hooks/types';

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

function TaskRow({
  entry,
  phases,
  collectionId,
  onRemove,
  onMoveToPhase,
}: {
  entry: CollectionTaskEntry;
  phases: CollectionPhase[];
  collectionId: string;
  onRemove: (taskId: string) => void;
  onMoveToPhase: (taskId: string, phaseId: string | null) => void;
}) {
  const t = entry.task;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 4 }}
      className="group flex items-center gap-3 py-2 px-3 rounded-md hover:bg-ghost-2 transition-colors"
    >
      <span className={`text-[10px] font-[510] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CHIP[t.status] ?? ''}`}>
        {STATUS_LABEL[t.status] ?? t.status}
      </span>
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
          onClick={() => onRemove(t.id)}
          className="p-1 rounded text-fg-4 hover:text-danger hover:bg-ghost-2 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </motion.div>
  );
}

function PhaseColumn({
  phase,
  tasks,
  allPhases,
  collectionId,
  onDeletePhase,
  onRemoveTask,
  onMoveToPhase,
}: {
  phase: CollectionPhase | null; // null = unphased
  tasks: CollectionTaskEntry[];
  allPhases: CollectionPhase[];
  collectionId: string;
  onDeletePhase?: (id: string) => void;
  onRemoveTask: (taskId: string) => void;
  onMoveToPhase: (taskId: string, phaseId: string | null) => void;
}) {
  return (
    <div className="flex flex-col min-w-[240px] sm:min-w-[280px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[12px] font-[510] text-fg-2">
          {phase?.title ?? 'Unassigned'} <span className="text-fg-4">({tasks.length})</span>
        </span>
        {phase && onDeletePhase && (
          <button
            onClick={() => onDeletePhase(phase.id)}
            className="p-0.5 rounded text-fg-4 hover:text-danger transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5 bg-surface-2 rounded-lg p-2 min-h-[80px]">
        <AnimatePresence mode="popLayout">
          {tasks.map((e) => (
            <TaskRow
              key={e.taskId}
              entry={e}
              phases={allPhases}
              collectionId={collectionId}
              onRemove={onRemoveTask}
              onMoveToPhase={onMoveToPhase}
            />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <p className="text-[11px] text-fg-4 text-center py-4">Empty</p>
        )}
      </div>
    </div>
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

  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [addingPhase, setAddingPhase] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [searchTask, setSearchTask] = useState('');

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

  const tasksByPhase = new Map<string | null, CollectionTaskEntry[]>();
  tasksByPhase.set(null, []);
  for (const p of collection.phases) tasksByPhase.set(p.id, []);
  for (const t of collection.tasks) {
    const key = t.phaseId ?? null;
    const list = tasksByPhase.get(key) ?? [];
    list.push(t);
    tasksByPhase.set(key, list);
  }

  const memberIds = new Set(collection.tasks.map((t) => t.taskId));
  const candidateTasks = (allTasks ?? []).filter(
    (t) => !memberIds.has(t.id) && t.title.toLowerCase().includes(searchTask.toLowerCase()),
  );

  async function handleAddPhase() {
    if (!newPhaseTitle.trim()) return;
    const p = createPhase.mutateAsync({ collectionId: id, title: newPhaseTitle.trim() });
    toast.promise(p, {
      loading: 'Adding phase…',
      success: 'Phase added',
      error: (err) => err?.message ?? 'Failed',
    });
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

  const deadline = collection.deadline ? new Date(collection.deadline) : null;
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

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
        <button
          onClick={() => setAddingPhase(!addingPhase)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-fg-3 hover:text-fg border border-wire rounded-md hover:border-wire-2 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add phase
        </button>
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

      {/* Add phase panel */}
      <AnimatePresence>
        {addingPhase && (
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

      {/* Phase columns */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6">
        {collection.tasks.length === 0 && collection.phases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-fg-3 text-[13px]">No tasks yet</p>
            <p className="text-fg-4 text-[12px]">Add tasks from your task list, or create new ones via chat.</p>
          </div>
        ) : (
          <div className={`flex gap-4 ${collection.phases.length === 0 ? '' : 'items-start'}`}>
            {collection.phases.length === 0 ? (
              <div className="w-full max-w-xl flex flex-col gap-0.5">
                <AnimatePresence mode="popLayout">
                  {collection.tasks.map((e) => (
                    <TaskRow
                      key={e.taskId}
                      entry={e}
                      phases={[]}
                      collectionId={id}
                      onRemove={handleRemoveTask}
                      onMoveToPhase={handleMoveToPhase}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <>
                {collection.phases.map((phase) => (
                  <PhaseColumn
                    key={phase.id}
                    phase={phase}
                    tasks={tasksByPhase.get(phase.id) ?? []}
                    allPhases={collection.phases}
                    collectionId={id}
                    onDeletePhase={handleDeletePhase}
                    onRemoveTask={handleRemoveTask}
                    onMoveToPhase={handleMoveToPhase}
                  />
                ))}
                {(tasksByPhase.get(null) ?? []).length > 0 && (
                  <PhaseColumn
                    phase={null}
                    tasks={tasksByPhase.get(null) ?? []}
                    allPhases={collection.phases}
                    collectionId={id}
                    onRemoveTask={handleRemoveTask}
                    onMoveToPhase={handleMoveToPhase}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
