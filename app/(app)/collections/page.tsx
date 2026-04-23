'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
} from '@/lib/hooks/use-collections';
import type { CollectionWithPhases } from '@/lib/hooks/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-brand/20 text-brand',
  completed: 'bg-success/20 text-success',
  archived: 'bg-fg-4/20 text-fg-4',
};

function CollectionCard({
  collection,
  onDelete,
}: {
  collection: CollectionWithPhases;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const progress = collection.taskCount > 0
    ? Math.round((collection.doneCount / collection.taskCount) * 100)
    : 0;
  const deadline = collection.deadline ? new Date(collection.deadline) : null;
  const isOverdue = deadline && deadline < new Date() && collection.status === 'active';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group bg-surface border border-wire rounded-lg p-4 cursor-pointer hover:border-wire-2 transition-colors flex flex-col gap-3"
      onClick={() => router.push(`/collections/${collection.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {collection.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: collection.color }}
            />
          )}
          <h3 className="text-fg text-[14px] font-[510] truncate">{collection.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[collection.status] ?? ''}`}>
            {collection.status}
          </span>
          <button
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-fg-4 hover:text-danger hover:bg-ghost-2 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(collection.id);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>

      {collection.description && (
        <p className="text-fg-3 text-[12px] leading-relaxed line-clamp-2">{collection.description}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-fg-4">
          <span>{collection.taskCount} task{collection.taskCount !== 1 ? 's' : ''}</span>
          <span>{progress}% done</span>
        </div>
        <div className="h-1 rounded-full bg-ghost-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-fg-4">
        <span>{collection.phases.length} phase{collection.phases.length !== 1 ? 's' : ''}</span>
        {deadline && (
          <span className={isOverdue ? 'text-danger' : ''}>
            {isOverdue ? 'Overdue · ' : ''}
            {deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function CreateCollectionModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('');
  const createCollection = useCreateCollection();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const p = createCollection.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      deadline: deadline || undefined,
      color: color || undefined,
    });
    toast.promise(p, {
      loading: 'Creating collection…',
      success: 'Collection created',
      error: (err) => err?.message ?? 'Failed to create collection',
    });
    try {
      await p;
      onClose();
    } catch {
      // toast shows the error; keep modal open so user can retry
    }
  }

  // eslint-disable-next-line kairos/no-raw-colors -- user-facing color pickers are not design tokens
  const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface border border-wire rounded-xl w-full max-w-md p-5"
      >
        <h2 className="text-fg text-[15px] font-[510] mb-4">New Collection</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-fg-3 mb-1 block">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SIT221, Sprint 4, Research"
              className="w-full bg-surface-2 border border-wire rounded-md px-3 py-2 text-[13px] text-fg placeholder:text-fg-4 outline-none focus:border-brand transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] text-fg-3 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-surface-2 border border-wire rounded-md px-3 py-2 text-[13px] text-fg placeholder:text-fg-4 outline-none focus:border-brand transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-fg-3 mb-1 block">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full bg-surface-2 border border-wire rounded-md px-3 py-2 text-[13px] text-fg outline-none focus:border-brand transition-colors"
              />
            </div>
            <div>
              <label className="text-[12px] text-fg-3 mb-1 block">Color</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-5 h-5 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-1 ring-offset-surface ring-brand scale-110' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(color === c ? '' : c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[13px] text-fg-3 hover:text-fg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createCollection.isPending}
              className="px-4 py-1.5 bg-brand text-white text-[13px] font-[510] rounded-md hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function CollectionsPage() {
  const { data: collections, isLoading } = useCollections();
  const deleteCollection = useDeleteCollection();
  const [showCreate, setShowCreate] = useState(false);

  function handleDelete(id: string) {
    if (!confirm('Delete this collection? Tasks will not be deleted.')) return;
    const p = deleteCollection.mutateAsync(id);
    toast.promise(p, {
      loading: 'Deleting…',
      success: 'Collection deleted',
      error: (err) => err?.message ?? 'Failed',
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-fg text-[18px] font-[510]">Collections</h1>
          <p className="text-fg-3 text-[12px] mt-0.5">
            Group tasks into phases and track progress
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-[13px] font-[510] rounded-md hover:bg-brand/90 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-wire rounded-lg p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : collections && collections.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c} onDelete={handleDelete} />
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-3">
          <div className="w-10 h-10 rounded-full bg-ghost-2 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h4l2-3h6l2 3h4a2 2 0 012 2v11a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2z" />
            </svg>
          </div>
          <p className="text-fg-3 text-[13px]">No collections yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-brand text-[13px] hover:underline"
          >
            Create your first collection
          </button>
        </div>
      )}

      {showCreate && <CreateCollectionModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
