'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useUpdateCalendarEvent, useDeleteCalendarEvent } from '@/lib/hooks/use-calendars';
import type { CalendarEvent } from '@/lib/hooks/types';

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  event: CalendarEvent;
  onClose: () => void;
}

export function EventEditModal({ event, onClose }: Props) {
  const [summary, setSummary] = useState(event.summary ?? '');
  const [description, setDescription] = useState(event.description ?? '');
  const [start, setStart] = useState(event.start ? toLocal(event.start) : '');
  const [end, setEnd] = useState(event.end ? toLocal(event.end) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  function handleDelete() {
    const p = deleteEvent.mutateAsync({ id: event.id, calendarId: event.calendarId });
    toast.promise(p, { loading: 'Deleting…', success: 'Event deleted', error: (e) => e?.message ?? 'Failed' });
    p.then(onClose).catch(() => {});
  }

  function handleSave() {
    const p = updateEvent.mutateAsync({
      id: event.id,
      calendarId: event.calendarId,
      summary: summary.trim() || undefined,
      description: description.trim() || undefined,
      start: start ? new Date(start).toISOString() : undefined,
      end: end ? new Date(end).toISOString() : undefined,
    });
    toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => e?.message ?? 'Failed' });
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
      {/* Centering layer */}
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
            <div>
              <h2 className="text-sm font-[510] text-fg">Edit event</h2>
              <p className="text-[10px] text-fg-4 mt-0.5">{event.calendarName}</p>
            </div>
            <button onClick={onClose} className="text-fg-3 hover:text-fg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Title</label>
              <input
                className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Event title"
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
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Start</label>
                <input
                  type="datetime-local"
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">End</label>
                <input
                  type="datetime-local"
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-wire">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger">Delete this event?</span>
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
                disabled={updateEvent.isPending}
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
