'use client';

import { useState, useMemo } from 'react';
import { useTasks } from '@/lib/hooks/use-tasks';
import { useCalendarEvents } from '@/lib/hooks/use-calendars';
import { CalendarWeek } from '@/components/app/calendar-week';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.toLocaleDateString('en-US', { month: 'short' })} ${monday.getDate()}–${sunday.getDate()}, ${monday.getFullYear()}`;
  }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${monday.getFullYear()}`;
}

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  const { data: tasks = [] } = useTasks({ status: 'scheduled' });
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents(weekStart, weekEnd);

  function prevWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function goToday() {
    setWeekStart(getMonday(new Date()));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="shrink-0 sticky top-0 z-20 bg-surface border-b border-wire px-4 h-12 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="w-7 h-7 flex items-center justify-center rounded text-fg-3 hover:text-fg hover:bg-ghost-2 transition-colors"
            aria-label="Previous week"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={nextWeek}
            className="w-7 h-7 flex items-center justify-center rounded text-fg-3 hover:text-fg hover:bg-ghost-2 transition-colors"
            aria-label="Next week"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <span className="text-fg text-sm font-[510] flex-1">{formatWeekRange(weekStart)}</span>

        <button
          onClick={goToday}
          className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors"
        >
          Today
        </button>

      </header>

      <CalendarWeek weekStart={weekStart} tasks={tasks} events={events} />
    </div>
  );
}
