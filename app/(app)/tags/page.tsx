'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/lib/hooks/use-tags';
import type { Tag } from '@/lib/hooks/types';

/* eslint-disable kairos/no-raw-colors -- user-selectable tag palette; these are data values, not styling decisions */
const TAG_COLORS = [
  '#7170ff', '#5e6ad2', '#10b981', '#27a644',
  '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16',
];
/* eslint-enable kairos/no-raw-colors */

function TagForm({
  tag,
  onSave,
  onCancel,
}: {
  tag?: Tag;
  onSave: (name: string, color: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<string | null>(tag?.color ?? null);

  return (
    <div className="bg-surface-2 border border-wire rounded-xl p-4 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name"
        autoFocus
        className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent/30"
      />
      <div>
        <p className="text-fg-4 text-[11px] font-[510] uppercase tracking-wide mb-2">Color</p>
        <div className="flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c === color ? null : c)}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c,
                borderColor: c === color ? 'var(--color-fg)' : 'transparent',
                transform: c === color ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => setColor(null)}
            className="w-5 h-5 rounded-full border border-wire flex items-center justify-center text-fg-4 text-[9px] hover:border-fg-4 transition-colors"
            title="No color"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-fg-3 hover:text-fg-2 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => name.trim() && onSave(name.trim(), color)}
          disabled={!name.trim()}
          className="px-4 py-1.5 bg-brand hover:bg-accent text-white text-sm font-[510] rounded-md transition-colors disabled:opacity-40"
        >
          {tag ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
}

export default function TagsPage() {
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(name: string, color: string | null) {
    const p = createTag.mutateAsync({ name, ...(color ? { color } : {}) });
    toast.promise(p, { loading: 'Creating tag…', success: 'Tag created', error: 'Failed to create tag' });
    try { await p; setShowCreate(false); } catch { /* toast */ }
  }

  async function handleUpdate(id: string, name: string, color: string | null) {
    const p = updateTag.mutateAsync({ id, name, color });
    toast.promise(p, { loading: 'Saving…', success: 'Tag saved', error: 'Failed to save tag' });
    try { await p; setEditingId(null); } catch { /* toast */ }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center justify-between">
        <h1 className="text-fg text-sm font-[510]">Tags</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-[13px] font-[510] px-3 py-1.5 rounded-md transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New tag
        </button>
      </header>

      <div className="px-6 py-4 max-w-2xl space-y-2">
        {showCreate && (
          <TagForm
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-ghost rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tags && tags.length > 0 ? (
          tags.map((tag) =>
            editingId === tag.id ? (
              <TagForm
                key={tag.id}
                tag={tag}
                onSave={(name, color) => handleUpdate(tag.id, name, color)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={tag.id}
                className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-ghost border border-wire-2 hover:bg-ghost-2 hover:border-wire transition-all"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? 'var(--color-surface-3)' }}
                />
                <span className="flex-1 text-fg-2 text-sm font-[510]">{tag.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingId(tag.id)}
                    className="p-1 text-fg-4 hover:text-fg-2 transition-colors"
                    title="Edit"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                      <path d="M17.5 3.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteTag.mutate(tag.id)}
                    className="p-1 text-fg-4 hover:text-danger transition-colors"
                    title="Delete"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ),
          )
        ) : (
          <div className="text-center py-16">
            <p className="text-fg-4 text-sm mb-3">No tags yet.</p>
            <button onClick={() => setShowCreate(true)} className="text-accent text-sm hover:text-accent-2 transition-colors">
              Create your first tag →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
