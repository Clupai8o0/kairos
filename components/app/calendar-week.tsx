'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Task, CalendarEvent } from '@/lib/hooks/types';
import { useCalendarDrag, HOUR_PX } from '@/lib/hooks/use-calendar-drag';
import type { DragResult } from '@/lib/hooks/use-calendar-drag';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_MIN = HOUR_PX / 60;

function toMins(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function hourLabel(h: number) {
  if (h === 0) return '';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface EventBlockProps {
  top: number;
  height: number;
  label: string;
  sublabel?: string;
  color?: string;
  isTask?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}

function EventBlock({ top, height, label, sublabel, color, isTask, isDragging, onClick, onPointerDown }: EventBlockProps) {
  const h = Math.max(18, height);
  const style: React.CSSProperties = {
    position: 'absolute', top, height: h, left: 2, right: 2,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isTask ? 'var(--color-task-event-bg)' : color,
    borderLeft: isTask ? `3px ${isDragging ? 'dashed' : 'solid'} var(--color-accent)` : undefined,
    zIndex: isTask ? 3 : 2,
  };

  return (
    <div
      style={style}
      className={`rounded px-1.5 py-0.5 overflow-hidden select-none ${!isDragging && onClick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
      onClick={isDragging ? undefined : onClick}
      onPointerDown={onPointerDown}
    >
      <p className={`text-[10px] font-[510] leading-tight truncate ${isTask ? 'text-fg' : 'text-white'}`}>{label}</p>
      {sublabel && h > 26 && (
        <p className={`text-[9px] truncate ${isTask ? 'text-fg-3' : 'text-white/70'}`}>{sublabel}</p>
      )}
      {onPointerDown && h > 24 && (
        <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
      )}
    </div>
  );
}

// Skeleton event slots per day column (index 0 = Mon … 6 = Sun).
const SKELETON_SLOTS = [
  [{ hour: 9, h: 1 }, { hour: 14, h: 0.75 }],
  [{ hour: 10, h: 0.5 }, { hour: 15, h: 1 }],
  [{ hour: 9, h: 0.75 }, { hour: 11, h: 0.5 }, { hour: 14.5, h: 0.75 }],
  [{ hour: 13, h: 1 }],
  [{ hour: 9, h: 1.5 }, { hour: 14, h: 0.5 }],
  [{ hour: 11, h: 0.5 }],
  [],
] as const;

interface Props {
  weekStart: Date;
  tasks: Task[];
  events: CalendarEvent[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onTaskMove?: (taskId: string, result: DragResult) => void;
  onEventMove?: (eventId: string, result: DragResult) => void;
  onEventResize?: (eventId: string, result: DragResult) => void;
  onCreateEvent?: (result: DragResult) => void;
}

export function CalendarWeek({
  weekStart, tasks, events, isLoading = false,
  onTaskClick, onEventClick,
  onTaskMove, onEventMove, onEventResize, onCreateEvent,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { dragState, handleBlockPointerDown, handleGridPointerDown } = useCalendarDrag({
    gridRef: scrollRef,
    onMoveEnd: (id, type, result) => {
      if (type === 'task') onTaskMove?.(id, result);
      else onEventMove?.(id, result);
    },
    onResizeEnd: (id, type, result) => {
      if (type === 'event') onEventResize?.(id, result);
    },
    onCreateEnd: (result) => onCreateEvent?.(result),
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = Math.max(0, (toMins(now) - 60) * PX_PER_MIN);
      scrollRef.current.scrollTop = scrollTo;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const taskGcalIds = useMemo(
    () => new Set(tasks.map((t) => t.gcalEventId).filter(Boolean) as string[]),
    [tasks],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nowMins = toMins(now);
  const nowTop = nowMins * PX_PER_MIN;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Day header */}
      <div className="grid border-b border-wire bg-surface z-10 shrink-0" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
        <div className="border-r border-wire" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={`text-center py-2 border-r border-wire last:border-r-0 ${isToday ? 'text-accent' : 'text-fg-3'}`}>
              <p className="text-[10px] font-[510] uppercase tracking-wide">{DAY_NAMES[i]}</p>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto mt-0.5 text-xs font-[510] ${isToday ? 'bg-accent text-canvas' : 'text-fg-2'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="overflow-y-auto flex-1">
        <div className="relative grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)', height: HOUR_PX * 24 }}>
          {/* Time labels */}
          <div className="relative border-r border-wire">
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="relative border-b border-wire-2 flex items-start justify-end pr-2">
                <span className="text-[9px] text-fg-4 leading-none relative -top-[5px]">{hourLabel(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
            const isToday = isSameDay(day, today);

            const dayTasks = tasks.filter((t) => {
              if (!t.scheduledAt) return false;
              const s = new Date(t.scheduledAt);
              return s >= dayStart && s <= dayEnd;
            });

            const dayEvents = events.filter((e) => {
              if (e.isAllDay) return false;
              if (taskGcalIds.has(e.id)) return false;
              const s = new Date(e.start);
              return s >= dayStart && s <= dayEnd;
            });

            const showGhost = dragState
              && (dragState.mode === 'move' || dragState.mode === 'create')
              && dragState.dayIndex === dayIdx;

            return (
              <div
                key={dayIdx}
                className={`relative border-r border-wire last:border-r-0 ${isToday ? 'bg-ghost' : ''}`}
                onPointerDown={handleGridPointerDown}
              >
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_PX }} className="border-b border-wire-2" />
                ))}

                {isLoading && SKELETON_SLOTS[dayIdx].map((slot, si) => (
                  <div key={si} style={{ position: 'absolute', top: slot.hour * HOUR_PX, height: slot.h * HOUR_PX, left: 2, right: 2, zIndex: 2 }} className="rounded bg-surface-3 animate-pulse" />
                ))}

                {!isLoading && dayEvents.map((event) => {
                  const s = new Date(event.start);
                  const e = new Date(event.end);
                  const startMins = toMins(s);
                  const durationMins = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
                  const isSource = dragState?.sourceId === event.id;
                  const effectiveEnd = isSource && dragState?.mode === 'resize'
                    ? dragState.endMins : startMins + durationMins;
                  return (
                    <EventBlock
                      key={event.id}
                      top={startMins * PX_PER_MIN}
                      height={(effectiveEnd - startMins) * PX_PER_MIN}
                      color={event.calendarColor ?? 'var(--color-surface-3)'}
                      label={event.summary ?? '(no title)'}
                      sublabel={event.calendarName}
                      isDragging={isSource && dragState?.mode === 'move'}
                      onClick={onEventClick ? () => onEventClick(event) : undefined}
                      onPointerDown={(ev) => handleBlockPointerDown(ev, event.id, 'event', dayIdx, startMins, startMins + durationMins)}
                    />
                  );
                })}

                {dayTasks.map((task) => {
                  const s = new Date(task.scheduledAt!);
                  const startMins = toMins(s);
                  const durationMins = task.durationMins ?? 30;
                  const isSource = dragState?.sourceId === task.id;
                  const effectiveEnd = isSource && dragState?.mode === 'resize'
                    ? dragState.endMins : startMins + durationMins;
                  return (
                    <EventBlock
                      key={task.id}
                      top={startMins * PX_PER_MIN}
                      height={(effectiveEnd - startMins) * PX_PER_MIN}
                      isTask
                      label={task.title}
                      sublabel={task.durationMins ? `${task.durationMins} min` : undefined}
                      isDragging={isSource && dragState?.mode === 'move'}
                      onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                      onPointerDown={(ev) => handleBlockPointerDown(ev, task.id, 'task', dayIdx, startMins, startMins + durationMins)}
                    />
                  );
                })}

                {showGhost && (
                  <div
                    style={{
                      position: 'absolute',
                      top: dragState.startMins * PX_PER_MIN,
                      height: (dragState.endMins - dragState.startMins) * PX_PER_MIN,
                      left: 2, right: 2,
                      backgroundColor: 'var(--color-accent)',
                      opacity: 0.3, zIndex: 10,
                    }}
                    className="rounded pointer-events-none"
                  >
                    <p className="text-[9px] font-[510] text-fg px-1 pt-0.5 truncate">
                      {formatMins(dragState.startMins)} – {formatMins(dragState.endMins)}
                    </p>
                  </div>
                )}

                {isToday && (
                  <div style={{ position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 5 }} className="pointer-events-none">
                    <div className="relative h-px" style={{ backgroundColor: 'var(--color-danger)' }}>
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-danger)' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
