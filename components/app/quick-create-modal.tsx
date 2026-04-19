'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useCreateTask } from '@/lib/hooks/use-tasks';
import { useCalendars, useCreateCalendarEvent } from '@/lib/hooks/use-calendars';
import { useTags } from '@/lib/hooks/use-tags';

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Google Calendar event color palette (colorId "1"–"11")
// These are GCal API color IDs — not design tokens, disable raw-color rule here.
/* eslint-disable kairos/no-raw-colors */
const GCAL_COLORS: { id: string; label: string; hex: string }[] = [
  { id: '1', label: 'Lavender', hex: '#7986cb' },
  { id: '2', label: 'Sage', hex: '#33b679' },
  { id: '3', label: 'Grape', hex: '#8e24aa' },
  { id: '4', label: 'Flamingo', hex: '#e67c73' },
  { id: '5', label: 'Banana', hex: '#f6bf26' },
  { id: '6', label: 'Tangerine', hex: '#f4511e' },
  { id: '7', label: 'Peacock', hex: '#039be5' },
  { id: '8', label: 'Graphite', hex: '#616161' },
  { id: '9', label: 'Blueberry', hex: '#3f51b5' },
  { id: '10', label: 'Basil', hex: '#0b8043' },
  { id: '11', label: 'Tomato', hex: '#d50000' },
];
/* eslint-enable kairos/no-raw-colors */

interface Props {
  start: string; // ISO
  end: string;   // ISO
  onClose: () => void;
}

export function QuickCreateModal({ start, end, onClose }: Props) {
  const [kind, setKind] = useState<'event' | 'task'>('event');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState(toLocal(start));
  const [endLocal, setEndLocal] = useState(toLocal(end));

  // Task-specific
  const [priority, setPriority] = useState('3');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  const createEvent = useCreateCalendarEvent();
  const createTask = useCreateTask();
  const { data: calendars = [] } = useCalendars();
  const { data: allTags = [] } = useTags();

  const selectedCalendars = calendars.filter((c) => c.selected);
  const [calendarId, setCalendarId] = useState('');
  const [colorId, setColorId] = useState('');

  // Default to first selected calendar once loaded
  const effectiveCal = calendarId || selectedCalendars[0]?.calendarId || '';

  const durationMins = Math.round(
    (new Date(endLocal).getTime() - new Date(startLocal).getTime()) / 60_000,
  );

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCreate() {
    const startIso = new Date(startLocal).toISOString();
    const endIso = new Date(endLocal).toISOString();

    if (kind === 'event') {
      if (!effectiveCal) {
        toast.error('No calendar connected');
        return;
      }
      const p = createEvent.mutateAsync({
        calendarId: effectiveCal,
        summary: title.trim() || 'New event',
        description: description.trim() || undefined,
        start: startIso,
        end: endIso,
        ...(colorId ? { colorId } : {}),
      });
      toast.promise(p, {
        loading: 'Creating event…',
        success: 'Event created',
        error: (e) => (e as Error)?.message ?? 'Failed to create event',
      });
      p.then(onClose).catch(() => {});
    } else {
      const p = createTask.mutateAsync({
        title: title.trim() || 'New task',
        description: description.trim() || undefined,
        priority: Number(priority),
        schedulable: true,    // keep auto-schedulable so it can be unlocked later
        timeLocked: true,     // lock to the user-dragged time slot
        scheduledAt: startIso,
        scheduledEnd: endIso,
        durationMins: Math.max(15, durationMins),
        bufferMins: 0,
        isSplittable: false,
        dependsOn: [],
        tagIds: [...selectedTagIds],
      });
      toast.promise(p, {
        loading: 'Creating task…',
        success: 'Task created',
        error: (e) => (e as Error)?.message ?? 'Failed to create task',
      });
      p.then(onClose).catch(() => {});
    }
  }

  const isPending = createEvent.isPending || createTask.isPending;

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" />
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
            <h2 className="text-sm font-[510] text-fg">New {kind}</h2>
            <button onClick={onClose} className="text-fg-3 hover:text-fg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Event / Task toggle */}
            <div className="flex gap-1 p-0.5 bg-surface rounded-md">
              <button
                type="button"
                onClick={() => setKind('event')}
                className={`flex-1 text-xs font-[510] py-1.5 rounded transition-colors ${
                  kind === 'event'
                    ? 'bg-surface-3 text-fg'
                    : 'text-fg-3 hover:text-fg'
                }`}
              >
                Event
              </button>
              <button
                type="button"
                onClick={() => setKind('task')}
                className={`flex-1 text-xs font-[510] py-1.5 rounded transition-colors ${
                  kind === 'task'
                    ? 'bg-surface-3 text-fg'
                    : 'text-fg-3 hover:text-fg'
                }`}
              >
                Task
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Title</label>
              <input
                className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === 'event' ? 'Event title' : 'Task title'}
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
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">End</label>
                <input
                  type="datetime-local"
                  className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                />
              </div>
            </div>

            {/* Event-specific: calendar + color */}
            {kind === 'event' && (
              <>
                {selectedCalendars.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1">Calendar</label>
                    <select
                      className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                      value={effectiveCal}
                      onChange={(e) => setCalendarId(e.target.value)}
                    >
                      {selectedCalendars.map((cal) => (
                        <option key={cal.calendarId} value={cal.calendarId}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-[510] uppercase tracking-wide text-fg-3 mb-1.5">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setColorId('')}
                      title="Calendar default"
                      className={`w-5 h-5 rounded-full border-2 transition-colors bg-surface-3 ${
                        colorId === '' ? 'border-fg' : 'border-transparent hover:border-wire-2'
                      }`}
                    />
                    {GCAL_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColorId(c.id)}
                        title={c.label}
                        className={`w-5 h-5 rounded-full border-2 transition-colors ${
                          colorId === c.id ? 'border-fg' : 'border-transparent hover:border-wire-2'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Task-specific fields */}
            {kind === 'task' && (
              <>
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
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-wire">
            <button
              onClick={onClose}
              className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-3 py-1.5 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="text-xs font-[510] text-fg bg-accent hover:bg-accent-hover disabled:opacity-40 px-3 py-1.5 rounded transition-colors"
            >
              Create {kind}
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
