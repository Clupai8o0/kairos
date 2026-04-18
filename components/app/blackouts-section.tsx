'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useBlackouts, useCreateBlackout, useUpdateBlackout, useDeleteBlackout } from '@/lib/hooks/use-blackouts';
import type { BlackoutBlock } from '@/lib/hooks/types';

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRange(b: BlackoutBlock): string {
  const s = new Date(b.startAt);
  const e = new Date(b.endAt);
  const sameDay = s.toDateString() === e.toDateString();
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `${fmt(s)} ${time(s)}–${time(e)}`;
  return `${fmt(s)} ${time(s)} – ${fmt(e)} ${time(e)}`;
}

function describeRecurrence(rule: Record<string, unknown> | null): string | null {
  if (!rule) return null;
  const freq = rule.freq as string | undefined;
  const interval = (rule.interval as number) ?? 1;
  if (!freq) return null;
  const label = freq === 'daily' ? 'day' : freq === 'weekly' ? 'week' : freq === 'monthly' ? 'month' : freq;
  return interval === 1 ? `Every ${label}` : `Every ${interval} ${label}s`;
}

/* ───────── Add / edit form ───────── */

type FormData = { startAt: string; endAt: string; reason: string; recurring: boolean; freq: string; interval: string };

function defaultForm(): FormData {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return { startAt: toLocal(now.toISOString()), endAt: toLocal(later.toISOString()), reason: '', recurring: false, freq: 'weekly', interval: '1' };
}

function BlackoutForm({ initial, onSubmit, onCancel, isPending }: {
  initial?: FormData;
  onSubmit: (data: { startAt: string; endAt: string; reason?: string; recurrenceRule?: Record<string, unknown> }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial ?? defaultForm());

  function handleSubmit() {
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (end <= start) { toast.error('End must be after start'); return; }
    onSubmit({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: form.reason.trim() || undefined,
      recurrenceRule: form.recurring ? { freq: form.freq, interval: Number(form.interval) || 1 } : undefined,
    });
  }

  return (
    <div className="space-y-3 p-4 rounded-lg border border-wire-2 bg-ghost">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Start</label>
          <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            className="w-full bg-surface-2 border border-wire rounded px-2.5 py-1.5 text-xs text-fg-2 focus:outline-none focus:border-brand" />
        </div>
        <div>
          <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">End</label>
          <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            className="w-full bg-surface-2 border border-wire rounded px-2.5 py-1.5 text-xs text-fg-2 focus:outline-none focus:border-brand" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Reason (optional)</label>
        <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Team standup"
          className="w-full bg-surface-2 border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-brand" />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            className="rounded border-wire accent-brand" />
          <span className="text-sm text-fg-2">Repeats</span>
        </label>
        {form.recurring && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-4">every</span>
            <input type="number" min={1} value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}
              className="w-12 bg-surface-2 border border-wire rounded px-2 py-1 text-xs text-fg-2 focus:outline-none focus:border-brand" />
            <select value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value })}
              className="bg-surface-2 border border-wire rounded px-2 py-1 text-xs text-fg-2 focus:outline-none focus:border-brand">
              <option value="daily">day(s)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSubmit} disabled={isPending}
          className="px-3 py-1.5 rounded text-xs font-[510] bg-brand text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
          Save
        </button>
        <button onClick={onCancel} className="text-xs text-fg-4 hover:text-fg transition-colors">Cancel</button>
      </div>
    </div>
  );
}

/* ───────── Blackout row ───────── */

function BlackoutRow({ block, onEdit }: { block: BlackoutBlock; onEdit: () => void }) {
  const deleteBlackout = useDeleteBlackout();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const recurrence = describeRecurrence(block.recurrenceRule);

  function handleDelete() {
    const p = deleteBlackout.mutateAsync(block.id);
    toast.promise(p, { loading: 'Deleting…', success: 'Blackout removed', error: (e) => e?.message ?? 'Failed' });
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-ghost border border-wire-2 gap-4">
      <div className="min-w-0">
        <p className="text-fg-2 text-sm font-[510]">{formatRange(block)}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {block.reason && <span className="text-fg-4 text-xs truncate">{block.reason}</span>}
          {recurrence && (
            <span className="text-[10px] text-fg-4 bg-surface-3 px-1.5 py-0.5 rounded-full shrink-0">{recurrence}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onEdit} className="text-[11px] text-fg-3 hover:text-fg transition-colors">Edit</button>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5">
            <button onClick={handleDelete} className="text-[11px] font-[510] text-danger">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-fg-4">No</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-fg-4 hover:text-danger transition-colors">Delete</button>
        )}
      </div>
    </div>
  );
}

/* ───────── Main section ───────── */

export function BlackoutsSection() {
  const { data: blackouts = [], isLoading } = useBlackouts();
  const createBlackout = useCreateBlackout();
  const updateBlackout = useUpdateBlackout();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleCreate(data: { startAt: string; endAt: string; reason?: string; recurrenceRule?: Record<string, unknown> }) {
    const p = createBlackout.mutateAsync(data);
    toast.promise(p, { loading: 'Creating…', success: 'Blackout created', error: (e) => e?.message ?? 'Failed' });
    p.then(() => setAdding(false)).catch(() => {});
  }

  function handleUpdate(id: string, data: { startAt: string; endAt: string; reason?: string; recurrenceRule?: Record<string, unknown> }) {
    const p = updateBlackout.mutateAsync({ id, ...data });
    toast.promise(p, { loading: 'Updating…', success: 'Blackout updated', error: (e) => e?.message ?? 'Failed' });
    p.then(() => setEditingId(null)).catch(() => {});
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">Blackout blocks</h2>
          <p className="text-fg-4 text-xs mt-0.5">Time ranges where Kairos will never schedule tasks.</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors">
          + Blackout
        </button>
      </div>

      {adding && (
        <div className="mb-3">
          <BlackoutForm onSubmit={handleCreate} onCancel={() => setAdding(false)} isPending={createBlackout.isPending} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-14 bg-ghost rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {blackouts.map((b) =>
            editingId === b.id ? (
              <BlackoutForm
                key={b.id}
                initial={{ startAt: toLocal(b.startAt), endAt: toLocal(b.endAt), reason: b.reason ?? '', recurring: !!b.recurrenceRule, freq: (b.recurrenceRule?.freq as string) ?? 'weekly', interval: String((b.recurrenceRule?.interval as number) ?? 1) }}
                onSubmit={(data) => handleUpdate(b.id, data)}
                onCancel={() => setEditingId(null)}
                isPending={updateBlackout.isPending}
              />
            ) : (
              <BlackoutRow key={b.id} block={b} onEdit={() => setEditingId(b.id)} />
            ),
          )}
          {blackouts.length === 0 && !adding && (
            <div className="px-4 py-5 rounded-lg bg-ghost border border-wire-2 text-center">
              <p className="text-fg-4 text-sm">No blackout blocks configured.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
