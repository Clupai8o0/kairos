'use client';

import { useMemo, useState, useCallback } from 'react';
import type { Task, CalendarEvent } from '@/lib/hooks/types';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthGrid(monthStart: Date): Date[] {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const dow = first.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() + offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const SWIPE_THRESHOLD = 60;

interface Props {
  monthStart: Date;
  tasks: Task[];
  events: CalendarEvent[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onNavigate?: (dir: 'prev' | 'next') => void;
}

export function CalendarMonth({ monthStart, tasks, events, isLoading, onTaskClick, onEventClick, onNavigate }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const month = monthStart.getMonth();
  const days = useMemo(() => getMonthGrid(monthStart), [monthStart]);
  const [swipeDx, setSwipeDx] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    setSwiping(true);

    const onMove = (ev: globalThis.PointerEvent) => setSwipeDx(ev.clientX - x0);

    const onUp = (ev: globalThis.PointerEvent) => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      const dx = ev.clientX - x0;
      setSwiping(false);
      setSwipeDx(0);
      if (dx < -SWIPE_THRESHOLD) onNavigate?.('next');
      else if (dx > SWIPE_THRESHOLD) onNavigate?.('prev');
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }, [onNavigate]);

  return (
    <div
      className="flex flex-col min-h-0 flex-1 overflow-auto"
      style={{
        transform: swipeDx !== 0 ? `translateX(${swipeDx}px)` : undefined,
        transition: swiping ? 'none' : 'transform 0.2s ease',
      }}
    >
      {/* Day-of-week headers — drag horizontally to navigate months */}
      <div
        className="grid grid-cols-7 border-b border-wire bg-surface shrink-0 select-none"
        style={{ cursor: swiping ? 'grabbing' : 'grab' }}
        onPointerDown={handleHeaderPointerDown}
      >
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center py-2 text-[10px] font-[510] uppercase tracking-wide text-fg-3">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* Month grid — border-l + border-t on parent, border-r + border-b on each cell */}
      <div className="grid grid-cols-7 border-l border-t border-wire flex-1 min-h-0">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);

          const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);

          const dayTasks = tasks.filter((t) => {
            if (!t.scheduledAt) return false;
            const s = new Date(t.scheduledAt);
            return s >= dayStart && s <= dayEnd;
          });

          const dayEvents = events.filter((e) => {
            const s = new Date(e.start);
            return s >= dayStart && s <= dayEnd;
          });

          type Item = { id: string; label: string; isTask: boolean; color?: string; onClick: () => void };
          const allItems: Item[] = [
            ...dayTasks.map((t): Item => ({
              id: t.id, label: t.title, isTask: true,
              onClick: () => onTaskClick?.(t),
            })),
            ...dayEvents.map((e): Item => ({
              id: e.id, label: e.summary ?? '(no title)', isTask: false,
              color: e.calendarColor ?? undefined,
              onClick: () => onEventClick?.(e),
            })),
          ];
          const visible = allItems.slice(0, 3);
          const overflow = allItems.length - 3;

          return (
            <div
              key={i}
              className={`border-r border-b border-wire min-h-[72px] sm:min-h-[96px] p-1 flex flex-col gap-0.5 ${!inMonth ? 'bg-ghost' : ''}`}
            >
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-[510] shrink-0 ${
                isToday ? 'bg-accent text-canvas' : inMonth ? 'text-fg-2' : 'text-fg-4'
              }`}>
                {day.getDate()}
              </div>

              {isLoading ? (
                (i % 3 === 0 || i % 7 === 2) && (
                  <div className="h-3.5 rounded bg-surface-3 animate-pulse mt-0.5" />
                )
              ) : (
                <>
                  {visible.map((item) => (
                    <button
                      key={item.id}
                      onClick={item.onClick}
                      style={
                        item.isTask
                          ? { borderLeftColor: 'var(--color-accent)', backgroundColor: 'var(--color-task-event-bg)' }
                          : { backgroundColor: item.color ?? 'var(--color-surface-3)' }
                      }
                      className={`w-full text-left text-[9px] sm:text-[10px] font-[510] truncate px-1 py-px rounded ${
                        item.isTask ? 'border-l-2 text-fg' : 'text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <p className="text-[9px] text-fg-4 px-1">+{overflow} more</p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
