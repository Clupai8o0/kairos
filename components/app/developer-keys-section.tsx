'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useDeveloperKeys,
  useCreateDeveloperKey,
  useDeleteDeveloperKey,
} from '@/lib/hooks/use-developer-keys';
import type { CreatedKey } from '@/lib/hooks/use-developer-keys';

const SCOPE_LABELS: Record<string, string> = {
  '*': 'All access',
  'tasks:read': 'Read tasks',
  'tasks:write': 'Write tasks',
  'schedule:run': 'Run scheduler',
  'gcal:sync': 'Sync Google Calendar',
  'tags:read': 'Read tags',
  'tags:write': 'Write tags',
  'collections:read': 'Read collections',
  'collections:write': 'Write collections',
};

const ALL_SCOPES = Object.keys(SCOPE_LABELS).filter((s) => s !== '*');

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DeveloperKeysSection() {
  const { data, isLoading } = useDeveloperKeys();
  const create = useCreateDeveloperKey();
  const del = useDeleteDeveloperKey();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['tasks:read', 'tasks:write', 'schedule:run', 'gcal:sync']);
  const [newKey, setNewKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreate() {
    if (!name.trim() || scopes.length === 0) return;
    const p = create.mutateAsync({ name: name.trim(), scopes });
    toast.promise(p, { loading: 'Creating key…', success: 'Key created', error: (e) => e?.message ?? 'Failed' });
    try {
      const result = await p;
      setNewKey(result);
      setShowForm(false);
      setName('');
      setScopes(['tasks:read', 'tasks:write', 'schedule:run', 'gcal:sync']);
    } catch {}
  }

  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDelete(id: string, keyName: string) {
    const p = del.mutateAsync(id);
    toast.promise(p, { loading: 'Revoking…', success: `"${keyName}" revoked`, error: 'Failed to revoke' });
  }

  return (
    <div className="space-y-2">
      {/* One-time key reveal */}
      {newKey && (
        <div className="px-4 py-4 rounded-lg bg-surface-2 border border-accent/40 space-y-3">
          <div>
            <p className="text-fg-2 text-xs font-[510] mb-1">Copy your API key now — it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-accent bg-surface-3 rounded px-2.5 py-1.5 break-all select-all">
                {newKey.key}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 text-xs font-[510] px-3 py-1.5 rounded-md bg-brand text-white hover:bg-accent transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-fg-4 text-xs hover:text-fg-3 transition-colors"
          >
            I&apos;ve copied it →
          </button>
        </div>
      )}

      {/* Existing keys */}
      {isLoading ? (
        <div className="h-16 bg-ghost rounded-lg animate-pulse" />
      ) : data?.keys && data.keys.length > 0 ? (
        data.keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between px-4 py-3.5 rounded-lg bg-ghost border border-wire-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-fg-2 text-sm font-[510]">{k.name}</p>
                <code className="text-fg-4 text-[11px] font-mono">{k.prefix}…</code>
              </div>
              <p className="text-fg-4 text-xs mt-0.5">
                {k.scopes.includes('*') ? 'All access' : k.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')}
                {' · '}Last used {fmtDate(k.lastUsedAt)}
              </p>
            </div>
            <button
              onClick={() => handleDelete(k.id, k.name)}
              disabled={del.isPending}
              className="text-danger text-[11px] font-[510] hover:text-danger/80 transition-colors disabled:opacity-50 ml-4"
            >
              Revoke
            </button>
          </div>
        ))
      ) : (
        !newKey && (
          <div className="px-4 py-4 rounded-lg bg-ghost border border-wire-2">
            <p className="text-fg-4 text-sm text-center">No API keys yet.</p>
          </div>
        )
      )}

      {/* Create form */}
      {showForm ? (
        <div className="px-4 py-4 rounded-lg bg-ghost border border-wire-2 space-y-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. My Agent"
            className="w-full bg-surface-2 border border-wire rounded-md px-3 py-1.5 text-fg text-xs placeholder:text-fg-4 focus:outline-none focus:border-accent"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false); }}
          />
          <div>
            <p className="text-fg-4 text-[10px] font-[510] uppercase tracking-wide mb-2">Scopes</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SCOPES.map((scope) => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  className={[
                    'text-[11px] px-2 py-1 rounded-full border transition-colors',
                    scopes.includes(scope)
                      ? 'bg-brand/10 border-brand/40 text-accent'
                      : 'bg-surface-2 border-wire text-fg-4 hover:border-wire-2',
                  ].join(' ')}
                >
                  {SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!name.trim() || scopes.length === 0 || create.isPending}
              className="text-xs font-[510] px-3 py-1.5 rounded-md bg-brand text-white hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs font-[510] px-3 py-1.5 rounded-md bg-surface-3 text-fg-3 hover:text-fg-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        !newKey && (
          <button
            onClick={() => setShowForm(true)}
            className="text-fg-3 text-[11px] font-[510] hover:text-fg-2 transition-colors"
          >
            + New API key
          </button>
        )
      )}

      <p className="text-fg-4 text-xs pt-1">
        Keys authenticate as you — keep them secret. Use{' '}
        <code className="font-mono text-fg-3">Authorization: Bearer &lt;key&gt;</code> in requests.
        See <a href="/agent-api.md" target="_blank" className="text-accent hover:underline">agent-api.md</a> for the full API reference.
      </p>
    </div>
  );
}
