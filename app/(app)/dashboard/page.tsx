'use client';

import { useTasks } from '@/lib/hooks/use-tasks';
import { useTags } from '@/lib/hooks/use-tags';
import type { Task } from '@/lib/hooks/types';

const STATUS_COLOR: Record<Task['status'], string> = {
  pending: 'text-fg-4',
  scheduled: 'text-accent',
  in_progress: 'text-success',
  done: 'text-emerald',
  cancelled: 'text-fg-4',
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-ghost border border-wire rounded-lg px-4 py-3">
      <p className="text-fg-4 text-[11px] font-[510] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-fg text-2xl font-[510]">{value}</p>
      {sub && <p className="text-fg-4 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: tasks, isLoading } = useTasks();
  const { data: tags } = useTags();

  const pending = tasks?.filter((t) => t.status === 'pending').length ?? 0;
  const inProgress = tasks?.filter((t) => t.status === 'in_progress').length ?? 0;
  const scheduled = tasks?.filter((t) => t.status === 'scheduled').length ?? 0;
  const done = tasks?.filter((t) => t.status === 'done').length ?? 0;

  const upcoming = tasks
    ?.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center">
        <h1 className="text-fg text-sm font-[510]">Dashboard</h1>
      </header>

      <div className="px-6 py-6 max-w-3xl">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Pending" value={pending} />
          <StatCard label="In Progress" value={inProgress} />
          <StatCard label="Scheduled" value={scheduled} />
          <StatCard label="Done" value={done} sub="total" />
        </div>

        {/* Upcoming deadlines */}
        <div className="mb-8">
          <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide mb-3">
            Upcoming deadlines
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-ghost rounded-lg animate-pulse" />
              ))}
            </div>
          ) : upcoming && upcoming.length > 0 ? (
            <ul className="space-y-1">
              {upcoming.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-ghost border border-wire-2 hover:bg-ghost-2 transition-colors"
                >
                  <span className={`text-[10px] font-[510] ${STATUS_COLOR[task.status]}`}>
                    {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '●' : '○'}
                  </span>
                  <span className="flex-1 text-fg-2 text-sm truncate">{task.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-[11px] font-[510] text-fg-3 border border-wire px-1.5 py-0.5 rounded-full"
                        style={tag.color ? { color: tag.color, borderColor: tag.color + '40' } : {}}
                      >
                        {tag.name}
                      </span>
                    ))}
                    <span className="text-fg-4 text-xs">{formatDate(task.deadline)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-4 text-sm">No upcoming deadlines.</p>
          )}
        </div>

        {/* Tags summary */}
        {tags && tags.length > 0 && (
          <div>
            <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide mb-3">
              Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs font-[510] text-fg-3 border border-wire px-2.5 py-1 rounded-full"
                  style={tag.color ? { color: tag.color, borderColor: tag.color + '40' } : {}}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
