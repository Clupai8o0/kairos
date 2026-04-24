'use client';

import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTasks, useUpdateTask } from '@/lib/hooks/use-tasks';
import { useCalendars, useCalendarEvents, useUpdateCalendarEvent } from '@/lib/hooks/use-calendars';
import { useRunSchedule } from '@/lib/hooks/use-schedule';
import { useSyncGCal, useGCalSyncAge } from '@/lib/hooks/use-gcal-sync';
import { CalendarWeek } from '@/components/app/calendar-week';
import { CalendarMonth } from '@/components/app/calendar-month';
import { TaskEditModal } from '@/components/app/task-edit-modal';
import { EventEditModal } from '@/components/app/event-edit-modal';
import { QuickCreateModal } from '@/components/app/quick-create-modal';
import type { Task, CalendarEvent } from '@/lib/hooks/types';
import type { DragResult } from '@/lib/hooks/use-calendar-drag';

type ViewMode = 'day' | '3-day' | 'week' | 'month';

const VIEW_OPTIONS: { mode: ViewMode; label: string; short: string }[] = [
  { mode: 'day', label: 'Day', short: 'D' },
  { mode: '3-day', label: '3 Day', short: '3D' },
  { mode: 'week', label: 'Week', short: 'W' },
  { mode: 'month', label: 'Month', short: 'M' },
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatRange(start: Date, mode: ViewMode): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (mode === 'day') {
    return start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
  if (mode === '3-day') {
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${start.getFullYear()}`;
  }
  if (mode === 'week') {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${start.getFullYear()}`;
  }
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function initialViewStart(mode: ViewMode): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (mode === 'week') return getMonday(today);
  if (mode === 'month') return new Date(today.getFullYear(), today.getMonth(), 1);
  return today;
}

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week'
  );
  const [viewStart, setViewStart] = useState(() => initialViewStart(
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week'
  ));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createDraft, setCreateDraft] = useState<{ start: string; end: string } | null>(null);
  const [lockPending, setLockPending] = useState<{ taskId: string; start: string; end: string } | null>(null);

  const runSchedule = useRunSchedule();
  const syncGCal = useSyncGCal();
  const { data: syncAge } = useGCalSyncAge();
  const updateTask = useUpdateTask();
  const updateEvent = useUpdateCalendarEvent();
  useCalendars();

  const dayCount = viewMode === 'day' ? 1 : viewMode === '3-day' ? 3 : 7;

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const first = new Date(viewStart.getFullYear(), viewStart.getMonth(), 1);
      const dow = first.getDay();
      const gridStart = new Date(first);
      gridStart.setDate(first.getDate() - (dow === 0 ? 6 : dow - 1));
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridStart.getDate() + 42);
      return { rangeStart: gridStart, rangeEnd: gridEnd };
    }
    const end = new Date(viewStart);
    end.setDate(end.getDate() + dayCount);
    return { rangeStart: viewStart, rangeEnd: end };
  }, [viewStart, viewMode, dayCount]);

  const { data: scheduledTasks = [] } = useTasks({ status: 'scheduled' });
  const { data: doneTasks = [] } = useTasks({ status: 'done' });
  const tasks = useMemo(() => [...scheduledTasks, ...doneTasks], [scheduledTasks, doneTasks]);
  const {
    data: rawEvents = [],
    isLoading: eventsLoading,
    isFetching: eventsFetching,
    refetch: refetchEvents,
  } = useCalendarEvents(rangeStart, rangeEnd);

  // Hide the GCal event for any done task — the task block itself is the visual
  const doneGcalIds = useMemo(
    () => new Set(doneTasks.map((t) => t.gcalEventId).filter(Boolean) as string[]),
    [doneTasks],
  );
  const events = useMemo(
    () => rawEvents.filter((e) => !doneGcalIds.has(e.id)),
    [rawEvents, doneGcalIds],
  );

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode);
    setViewStart((current) => {
      if (mode === 'week') return getMonday(current);
      if (mode === 'month') return new Date(current.getFullYear(), current.getMonth(), 1);
      return current;
    });
  }

  function prevPeriod() {
    setViewStart((d) => {
      const n = new Date(d);
      if (viewMode === 'day') n.setDate(n.getDate() - 1);
      else if (viewMode === '3-day') n.setDate(n.getDate() - 3);
      else if (viewMode === 'week') n.setDate(n.getDate() - 7);
      else n.setMonth(n.getMonth() - 1);
      return n;
    });
  }

  function nextPeriod() {
    setViewStart((d) => {
      const n = new Date(d);
      if (viewMode === 'day') n.setDate(n.getDate() + 1);
      else if (viewMode === '3-day') n.setDate(n.getDate() + 3);
      else if (viewMode === 'week') n.setDate(n.getDate() + 7);
      else n.setMonth(n.getMonth() + 1);
      return n;
    });
  }

  function goToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (viewMode === 'week') setViewStart(getMonday(today));
    else if (viewMode === 'month') setViewStart(new Date(today.getFullYear(), today.getMonth(), 1));
    else setViewStart(today);
  }

  const dragToTimes = useCallback((result: DragResult) => {
    const start = new Date(viewStart);
    start.setDate(start.getDate() + result.dayIndex);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(result.startMins);
    const end = new Date(viewStart);
    end.setDate(end.getDate() + result.dayIndex);
    end.setHours(0, 0, 0, 0);
    end.setMinutes(result.endMins);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [viewStart]);

  const handleTaskMove = useCallback((taskId: string, result: DragResult) => {
    const { start, end } = dragToTimes(result);
    setLockPending({ taskId, start, end });
  }, [dragToTimes]);

  const handleEventMove = useCallback((eventId: string, result: DragResult) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const { start, end } = dragToTimes(result);
    const p = updateEvent.mutateAsync({ id: eventId, calendarId: event.calendarId, start, end });
    toast.promise(p, {
      loading: 'Moving event…',
      success: 'Event moved',
      error: (e) => (e as Error)?.message ?? 'Failed to move event',
    });
  }, [dragToTimes, updateEvent, events]);

  const handleEventResize = useCallback((eventId: string, result: DragResult) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const { start, end } = dragToTimes(result);
    const p = updateEvent.mutateAsync({ id: eventId, calendarId: event.calendarId, start, end });
    toast.promise(p, {
      loading: 'Resizing event…',
      success: 'Event updated',
      error: (e) => (e as Error)?.message ?? 'Failed to resize event',
    });
  }, [dragToTimes, updateEvent, events]);

  const handleCreateEvent = useCallback((result: DragResult) => {
    const { start, end } = dragToTimes(result);
    setCreateDraft({ start, end });
  }, [dragToTimes]);

  function confirmLock() {
    if (!lockPending) return;
    const p = updateTask.mutateAsync({
      id: lockPending.taskId,
      scheduledAt: lockPending.start,
      scheduledEnd: lockPending.end,
      timeLocked: true,
      schedulable: true,
      status: 'scheduled',
    });
    toast.promise(p, {
      loading: 'Locking task…',
      success: 'Task locked to this time',
      error: (e) => (e as Error)?.message ?? 'Failed to lock task',
    });
    setLockPending(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="shrink-0 sticky top-0 z-20 bg-surface border-b border-wire px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevPeriod}
            className="w-7 h-7 flex items-center justify-center rounded text-fg-3 hover:text-fg hover:bg-ghost-2 transition-colors"
            aria-label="Previous period"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={nextPeriod}
            className="w-7 h-7 flex items-center justify-center rounded text-fg-3 hover:text-fg hover:bg-ghost-2 transition-colors"
            aria-label="Next period"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Date range label */}
        <span className="text-fg text-sm font-[510] flex-1 min-w-0 truncate">
          {formatRange(viewStart, viewMode)}
        </span>

        {/* View switcher */}
        <div className="flex items-center border border-wire rounded overflow-hidden">
          {VIEW_OPTIONS.map(({ mode, label, short }) => (
            <button
              key={mode}
              onClick={() => handleViewChange(mode)}
              className={`text-xs font-[510] px-2 py-1 transition-colors border-r border-wire last:border-r-0 ${
                viewMode === mode
                  ? 'bg-accent text-canvas'
                  : 'text-fg-3 hover:text-fg hover:bg-ghost-2'
              }`}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>

        {/* Actions — full-width on mobile to wrap to next line */}
        <div className="flex items-center gap-2 basis-full sm:basis-auto sm:ml-auto">
          <button
            onClick={goToday}
            className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors"
          >
            Today
          </button>

          <button
            onClick={() => {
              const p = refetchEvents().then((result) => {
                if (result.status === 'error') throw result.error;
              });
              toast.promise(p, {
                loading: 'Refreshing calendar…',
                success: 'Calendar updated',
                error: (e) => (e as Error)?.message ?? 'Failed to refresh',
              });
            }}
            disabled={eventsFetching}
            className="flex items-center gap-1.5 text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
            aria-label="Refresh calendar"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => syncGCal.mutate()}
            disabled={syncGCal.isPending}
            title={syncAge?.updatedAt ? `Last synced ${new Date(syncAge.updatedAt).toLocaleTimeString()}` : 'Calendar not yet synced — scheduling ignores busy times until synced'}
            className="flex items-center gap-1.5 text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10H3" /><path d="M21 6H3" /><path d="M21 14H3" /><path d="M21 18H3" />
              <rect x="3" y="4" width="18" height="16" rx="2" />
            </svg>
            <span className="hidden sm:inline">Sync GCal</span>
          </button>

          <button
            onClick={() => {
              const p = runSchedule.mutateAsync();
              toast.promise(p, {
                loading: 'Scheduling tasks…',
                success: (r) =>
                  r.remaining > 0
                    ? `Scheduled ${r.scheduled} task${r.scheduled === 1 ? '' : 's'}, ${r.remaining} remaining`
                    : `Scheduled ${r.scheduled} task${r.scheduled === 1 ? '' : 's'}`,
                error: (e) => (e as Error)?.message ?? 'Failed to run schedule',
              });
            }}
            disabled={runSchedule.isPending}
            className="flex items-center gap-1.5 text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span className="hidden sm:inline">Run schedule</span>
          </button>
        </div>
      </header>

      {viewMode === 'month' ? (
        <CalendarMonth
          monthStart={viewStart}
          tasks={tasks}
          events={events}
          isLoading={eventsLoading}
          onTaskClick={setSelectedTask}
          onEventClick={setSelectedEvent}
          onNavigate={(dir) => (dir === 'next' ? nextPeriod() : prevPeriod())}
        />
      ) : (
        <CalendarWeek
          weekStart={viewStart}
          dayCount={dayCount}
          tasks={tasks}
          events={events}
          isLoading={eventsLoading}
          onTaskClick={setSelectedTask}
          onEventClick={setSelectedEvent}
          onTaskMove={handleTaskMove}
          onEventMove={handleEventMove}
          onEventResize={handleEventResize}
          onCreateEvent={handleCreateEvent}
          onNavigate={(dir) => (dir === 'next' ? nextPeriod() : prevPeriod())}
        />
      )}

      <AnimatePresence>
        {selectedTask && (
          <TaskEditModal key="task-modal" task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEvent && (
          <EventEditModal key="event-modal" event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createDraft && (
          <QuickCreateModal
            key="create-modal"
            start={createDraft.start}
            end={createDraft.end}
            onClose={() => setCreateDraft(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lockPending && (
          <motion.div
            key="lock-confirm"
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" onClick={() => setLockPending(null)} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                className="bg-surface-2 border border-wire rounded-lg shadow-xl w-full max-w-sm p-5"
                initial={{ scale: 0.97, y: 6 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.97, y: 6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-[510] text-fg mb-1">Lock task to this time?</p>
                    <p className="text-xs text-fg-3">
                      {new Date(lockPending.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(lockPending.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {new Date(lockPending.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    <p className="text-[11px] text-fg-4 mt-1.5">The auto-scheduler won&apos;t move this task. If the time passes without completion, it will be unlocked and rescheduled automatically.</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setLockPending(null)}
                    className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-3 py-1.5 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmLock}
                    className="text-xs font-[510] bg-accent hover:bg-accent/90 text-canvas px-3 py-1.5 rounded transition-colors"
                  >
                    Lock time
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
