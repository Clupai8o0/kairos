'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCalendars, useUpdateCalendar, useSyncCalendars } from '@/lib/hooks/use-calendars';
import { usePlugins, useTogglePlugin } from '@/lib/hooks/use-plugins';
import { useScheduleWindows, useSetScheduleWindows, type WindowInput } from '@/lib/hooks/use-schedule-windows';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3">
        <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">{title}</h2>
        {description && <p className="text-fg-4 text-xs mt-0.5">{description}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        'relative w-9 h-5 rounded-full transition-colors shrink-0',
        checked ? 'bg-brand' : 'bg-surface-3',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

type DayState = { enabled: boolean; startTime: string; endTime: string };

function buildDayStates(windows: WindowInput[]): DayState[] {
  return DAYS.map((_, dow) => {
    const match = windows.find((w) => w.dayOfWeek === dow);
    return match
      ? { enabled: true, startTime: match.startTime, endTime: match.endTime }
      : { enabled: false, startTime: DEFAULT_START, endTime: DEFAULT_END };
  });
}

// dow 1–5 = Mon–Fri
const WEEKDAY_DOWS = [1, 2, 3, 4, 5];

function ScheduleEditor({ initialWindows }: { initialWindows: WindowInput[] }) {
  const setWindows = useSetScheduleWindows();
  const [days, setDays] = useState<DayState[]>(() => buildDayStates(initialWindows));
  const [dirty, setDirty] = useState(false);
  // dow of the row whose copy bar is open, or null
  const [copySource, setCopySource] = useState<number | null>(null);
  // set of target dows selected in the copy bar
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());

  function updateDay(dow: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === dow ? { ...d, ...patch } : d)));
    setDirty(true);
  }

  function openCopy(dow: number) {
    setCopySource(dow);
    // pre-select all other enabled days as a convenience
    const targets = new Set(
      days.map((d, i) => ({ d, i })).filter(({ d, i }) => d.enabled && i !== dow).map(({ i }) => i),
    );
    setCopyTargets(targets);
  }

  function toggleCopyTarget(dow: number) {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      next.has(dow) ? next.delete(dow) : next.add(dow);
      return next;
    });
  }

  function selectWeekdays(sourceDow: number) {
    setCopyTargets(new Set(WEEKDAY_DOWS.filter((d) => d !== sourceDow)));
  }

  function applyAndClose() {
    if (copySource === null) return;
    const src = days[copySource];
    setDays((prev) =>
      prev.map((d, i) =>
        copyTargets.has(i) ? { enabled: true, startTime: src.startTime, endTime: src.endTime } : d,
      ),
    );
    setDirty(true);
    setCopySource(null);
    setCopyTargets(new Set());
  }

  function handleSave() {
    const windows: WindowInput[] = days
      .map((d, dow) => ({ enabled: d.enabled, dayOfWeek: dow, startTime: d.startTime, endTime: d.endTime }))
      .filter((d) => d.enabled)
      .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));

    const p = setWindows.mutateAsync(windows);
    toast.promise(p, {
      loading: 'Saving schedule…',
      success: 'Schedule saved',
      error: (e) => e?.message ?? 'Failed to save',
    });
    p.then(() => setDirty(false)).catch(() => {});
  }

  return (
    <>
      <div className="rounded-lg border border-wire-2 overflow-hidden">
        {DAYS.map((label, dow) => {
          const d = days[dow];
          const isCopyOpen = copySource === dow;
          return (
            <div key={dow} className="border-b border-wire-2 last:border-b-0">
              {/* Day row */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Toggle
                  checked={d.enabled}
                  onChange={(v) => {
                    updateDay(dow, { enabled: v });
                    if (!v && copySource === dow) setCopySource(null);
                  }}
                />
                <span className={`w-8 text-sm font-[510] shrink-0 ${d.enabled ? 'text-fg-2' : 'text-fg-4'}`}>
                  {label}
                </span>
                {d.enabled ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="time"
                      value={d.startTime}
                      onChange={(e) => updateDay(dow, { startTime: e.target.value })}
                      className="bg-surface-2 border border-wire rounded px-2 py-1 text-xs text-fg-2 focus:outline-none focus:border-brand"
                    />
                    <span className="text-fg-4 text-xs">–</span>
                    <input
                      type="time"
                      value={d.endTime}
                      onChange={(e) => updateDay(dow, { endTime: e.target.value })}
                      className="bg-surface-2 border border-wire rounded px-2 py-1 text-xs text-fg-2 focus:outline-none focus:border-brand"
                    />
                    {/* Copy button */}
                    <button
                      onClick={() => isCopyOpen ? setCopySource(null) : openCopy(dow)}
                      title="Copy timing to other days"
                      className={[
                        'ml-1 p-1 rounded transition-colors',
                        isCopyOpen
                          ? 'text-brand bg-surface-2'
                          : 'text-fg-4 hover:text-fg-2 hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className="ml-auto text-xs text-fg-4">off</span>
                )}
              </div>

              {/* Copy bar — expands below when open */}
              {isCopyOpen && (
                <div className="px-4 pb-3 pt-0 border-t border-wire-2 bg-surface-2">
                  <div className="flex items-center gap-2 flex-wrap pt-2.5">
                    <span className="text-fg-4 text-xs shrink-0">Copy to:</span>
                    {DAYS.map((dlabel, tdow) => {
                      if (tdow === dow) return null;
                      const selected = copyTargets.has(tdow);
                      return (
                        <button
                          key={tdow}
                          onClick={() => toggleCopyTarget(tdow)}
                          className={[
                            'px-2 py-0.5 rounded text-xs font-[510] border transition-colors',
                            selected
                              ? 'bg-brand text-white border-brand'
                              : 'text-fg-3 border-wire hover:border-wire-2',
                          ].join(' ')}
                        >
                          {dlabel}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => selectWeekdays(dow)}
                      className="px-2 py-0.5 rounded text-xs font-[510] border border-wire hover:border-wire-2 text-fg-3 transition-colors"
                    >
                      Weekdays
                    </button>
                    <button
                      onClick={applyAndClose}
                      disabled={copyTargets.size === 0}
                      className="ml-auto px-3 py-0.5 rounded text-xs font-[510] bg-brand text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {dirty && (
        <button
          onClick={handleSave}
          disabled={setWindows.isPending}
          className="mt-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-[510] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Save schedule
        </button>
      )}
    </>
  );
}

function ScheduleSection() {
  const { data: savedWindows, isLoading } = useScheduleWindows();

  return (
    <Section
      title="Schedule"
      description="When Kairos is allowed to place tasks. Tasks only land in these windows."
    >
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-11 bg-ghost rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <ScheduleEditor key={savedWindows ? 'loaded' : 'empty'} initialWindows={savedWindows ?? []} />
      )}
    </Section>
  );
}

export default function SettingsPage() {
  const { data: calendars, isLoading: calsLoading } = useCalendars();
  const { data: plugins, isLoading: pluginsLoading } = usePlugins();
  const updateCalendar = useUpdateCalendar();
  const syncCalendars = useSyncCalendars();
  const togglePlugin = useTogglePlugin();
  const { data: session } = authClient.useSession();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/');
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-surface border-b border-wire px-6 h-12 flex items-center">
        <h1 className="text-fg text-sm font-[510]">Settings</h1>
      </header>

      <div className="px-6 py-6 max-w-xl">
        {/* Appearance */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">Appearance</h2>
          </div>
          <Link
            href="/settings/appearance"
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-ghost border border-wire-2 hover:border-wire transition-colors group"
          >
            <div>
              <p className="text-fg-2 text-sm font-[510]">Theme</p>
              <p className="text-fg-4 text-xs mt-0.5">Switch visual pack, including light mode</p>
            </div>
            <svg className="text-fg-4 group-hover:text-fg-3 transition-colors" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>

        {/* Schedule */}
        <ScheduleSection />

        {/* Account */}
        <Section title="Account">
          {session ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-ghost border border-wire-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-sm font-semibold text-fg-3 uppercase">
                  {session.user.name?.[0] ?? session.user.email?.[0] ?? '?'}
                </div>
                <div>
                  {session.user.name && (
                    <p className="text-fg-2 text-sm font-[510]">{session.user.name}</p>
                  )}
                  <p className="text-fg-4 text-xs">{session.user.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-fg-4 text-sm hover:text-fg-2 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="h-14 bg-ghost rounded-lg animate-pulse" />
          )}
        </Section>

        {/* Calendars */}
        <Section
          title="Google Calendars"
          description="Choose which calendars Kairos shows and schedules around."
        >
          <div className="flex justify-end mb-1">
            <button
              onClick={() =>
                toast.promise(syncCalendars.mutateAsync(), {
                  loading: 'Syncing calendars…',
                  success: (cals) => `${cals.length} calendar${cals.length === 1 ? '' : 's'} synced`,
                  error: 'Sync failed — check your Google connection',
                })
              }
              disabled={syncCalendars.isPending}
              className="flex items-center gap-1.5 text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Sync from Google
            </button>
          </div>

          {calsLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-14 bg-ghost rounded-lg animate-pulse" />
              ))}
            </div>
          ) : calendars && calendars.length > 0 ? (
            calendars.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-ghost border border-wire-2 gap-4"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cal.color ?? 'var(--color-brand)' }}
                  />
                  <div className="min-w-0">
                    <p className="text-fg-2 text-sm font-[510] truncate">{cal.name}</p>
                    <p className="text-fg-4 text-[11px] truncate">{cal.calendarId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[11px] text-fg-4">Show</span>
                    <Toggle
                      checked={cal.selected}
                      onChange={(v) =>
                        toast.promise(
                          updateCalendar.mutateAsync({ id: cal.id, selected: v }),
                          {
                            loading: v ? 'Enabling calendar…' : 'Disabling calendar…',
                            success: v ? `${cal.name} enabled` : `${cal.name} disabled`,
                            error: 'Failed to update calendar',
                          },
                        )
                      }
                      disabled={updateCalendar.isPending}
                    />
                  </label>
                  <label className={`flex items-center gap-1.5 ${cal.selected ? 'cursor-pointer' : 'opacity-40 pointer-events-none'}`}>
                    <span className="text-[11px] text-fg-4">Busy</span>
                    <Toggle
                      checked={cal.showAsBusy}
                      onChange={(v) =>
                        toast.promise(
                          updateCalendar.mutateAsync({ id: cal.id, showAsBusy: v }),
                          {
                            loading: 'Updating…',
                            success: v ? 'Marked as busy' : 'Marked as free',
                            error: 'Failed to update calendar',
                          },
                        )
                      }
                      disabled={updateCalendar.isPending || !cal.selected}
                    />
                  </label>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 rounded-lg bg-ghost border border-wire-2 text-center">
              <p className="text-fg-4 text-sm mb-2">No calendars found.</p>
              <button
                onClick={() =>
                  toast.promise(syncCalendars.mutateAsync(), {
                    loading: 'Syncing calendars…',
                    success: (cals) => `${cals.length} calendar${cals.length === 1 ? '' : 's'} synced`,
                    error: 'Sync failed',
                  })
                }
                disabled={syncCalendars.isPending}
                className="text-xs font-[510] text-accent hover:text-accent-2 transition-colors"
              >
                Sync from Google →
              </button>
            </div>
          )}
        </Section>

        {/* Plugins */}
        <Section
          title="Plugins"
          description="Enable or disable scratchpad plugins. Disabling a plugin prevents it from processing new entries."
        >
          {pluginsLoading ? (
            <div className="space-y-2">
              <div className="h-16 bg-ghost rounded-lg animate-pulse" />
            </div>
          ) : plugins && plugins.length > 0 ? (
            plugins.map((plugin) => (
              <div
                key={plugin.name}
                className="flex items-center justify-between px-4 py-3.5 rounded-lg bg-ghost border border-wire-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-fg-2 text-sm font-[510]">{plugin.displayName}</p>
                    <span className="text-fg-4 text-[11px] border border-wire px-1.5 py-0.5 rounded-full">
                      v{plugin.version}
                    </span>
                    {!plugin.enabled && (
                      <span className="text-fg-4 text-[11px] bg-surface-3 px-1.5 py-0.5 rounded-full">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="text-fg-4 text-xs mt-0.5 truncate">{plugin.description}</p>
                </div>
                <Toggle
                  checked={plugin.enabled}
                  onChange={(v) => togglePlugin.mutate({ name: plugin.name, enabled: v })}
                  disabled={togglePlugin.isPending}
                />
              </div>
            ))
          ) : (
            <div className="px-4 py-5 rounded-lg bg-ghost border border-wire-2">
              <p className="text-fg-4 text-sm text-center">No plugins installed.</p>
            </div>
          )}
        </Section>

        {/* LLM Provider */}
        <Section
          title="AI Provider"
          description="Configured via environment variables on the server."
        >
          <div className="px-4 py-4 rounded-lg bg-ghost border border-wire-2 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-fg-4">Provider</span>
              <span className="text-fg-2 font-mono text-xs">LLM_PROVIDER</span>
              <span className="text-fg-4">Model</span>
              <span className="text-fg-2 font-mono text-xs">LLM_MODEL</span>
              <span className="text-fg-4">API Key</span>
              <span className="text-fg-2 font-mono text-xs">OPENAI_API_KEY / ANTHROPIC_API_KEY</span>
            </div>
            <p className="text-fg-4 text-xs pt-1 border-t border-wire-2">
              Supports <code className="text-accent">openai</code>,{' '}
              <code className="text-accent">anthropic</code>, and{' '}
              <code className="text-accent">ollama</code> (OpenAI-compatible endpoint).
              Set <code className="text-accent">OLLAMA_URL</code> for a local model.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
