'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useViews, useCreateView, useDeleteView } from '@/lib/hooks/use-views';

export default function ViewsPage() {
  const { data: views, isLoading } = useViews();
  const createView = useCreateView();
  const deleteView = useDeleteView();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  async function handleCreate() {
    if (!name.trim()) return;
    const p = createView.mutateAsync({ name: name.trim() });
    toast.promise(p, { loading: 'Creating view…', success: 'View created', error: 'Failed to create view' });
    try { await p; setName(''); setShowCreate(false); } catch { /* toast */ }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center justify-between">
        <h1 className="text-fg text-sm font-[510]">Views</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-[13px] font-[510] px-3 py-1.5 rounded-md transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New view
        </button>
      </header>

      <div className="px-6 py-4 max-w-2xl space-y-2">
        {showCreate && (
          <div className="bg-surface-2 border border-wire rounded-xl p-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="View name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full bg-ghost border border-wire rounded-md px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreate(false); setName(''); }}
                className="px-3 py-1.5 text-sm text-fg-3 hover:text-fg-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createView.isPending}
                className="px-4 py-1.5 bg-brand hover:bg-accent text-white text-sm font-[510] rounded-md transition-colors disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-ghost rounded-lg animate-pulse" />
            ))}
          </div>
        ) : views && views.length > 0 ? (
          views.map((view) => (
            <div
              key={view.id}
              className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-ghost border border-wire-2 hover:bg-ghost-2 hover:border-wire transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-4 shrink-0">
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="flex-1 text-fg-2 text-sm font-[510]">{view.name}</span>
              <span className="text-fg-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                {new Date(view.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => deleteView.mutate(view.id)}
                className="p-1 text-fg-4 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-16">
            <p className="text-fg-4 text-sm mb-3">No views saved.</p>
            <p className="text-fg-4 text-xs mb-4">
              Views let you save filtered task lists for quick access.
            </p>
            <button onClick={() => setShowCreate(true)} className="text-accent text-sm hover:text-accent-2 transition-colors">
              Create your first view →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
