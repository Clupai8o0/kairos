'use client';

import { useTasks } from '@/lib/hooks/use-tasks';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function SchedulePage() {
  const { data: tasks, isLoading } = useTasks({ status: 'scheduled' });

  const scheduled = tasks?.filter((t) => t.scheduledAt).sort(
    (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
  ) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center">
        <h1 className="text-fg text-sm font-[510]">Schedule</h1>
      </header>

      <div className="px-6 py-4 max-w-2xl">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-ghost rounded-lg animate-pulse" />
            ))}
          </div>
        ) : scheduled.length > 0 ? (
          <ul className="space-y-2">
            {scheduled.map((task) => (
              <li key={task.id} className="flex gap-4 px-4 py-3 rounded-lg bg-ghost border border-wire-2">
                <div className="shrink-0 text-right">
                  <p className="text-accent text-xs font-[510]">{formatTime(task.scheduledAt!)}</p>
                  <p className="text-fg-4 text-[11px]">{formatDay(task.scheduledAt!)}</p>
                </div>
                <div className="border-l border-wire-2 pl-4">
                  <p className="text-fg-2 text-sm font-[510]">{task.title}</p>
                  {task.durationMins && (
                    <p className="text-fg-4 text-xs mt-0.5">{task.durationMins} min</p>
                  )}
                  {task.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5">
                      {task.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-[11px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full"
                          style={tag.color ? { color: tag.color, borderColor: tag.color + '40' } : {}}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-20">
            <div className="w-10 h-10 rounded-xl bg-ghost-3 border border-wire flex items-center justify-center mx-auto mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-4">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="text-fg-3 text-sm font-[510] mb-1">No scheduled tasks</p>
            <p className="text-fg-4 text-xs max-w-xs mx-auto">
              Tasks will appear here once they&apos;re placed into your Google Calendar.
              Schedule-on-write auto-places tasks when you create them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
