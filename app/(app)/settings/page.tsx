'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCalendars, useUpdateCalendar, useSyncCalendars } from '@/lib/hooks/use-calendars';
import { usePlugins, useTogglePlugin } from '@/lib/hooks/use-plugins';
import { useAiKeys, useSetAiKey, useDeleteAiKey } from '@/lib/hooks/use-ai-keys';
import { usePreferences, useUpdatePreferences } from '@/lib/hooks/use-preferences';
import { ScheduleSection } from '@/components/app/schedule-section';
import { BlackoutsSection } from '@/components/app/blackouts-section';
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

export default function SettingsPage() {
  const { data: calendars, isLoading: calsLoading } = useCalendars();
  const { data: plugins, isLoading: pluginsLoading } = usePlugins();
  const updateCalendar = useUpdateCalendar();
  const syncCalendars = useSyncCalendars();
  const togglePlugin = useTogglePlugin();
  const { data: aiKeys, isLoading: aiKeysLoading } = useAiKeys();
  const setAiKey = useSetAiKey();
  const deleteAiKey = useDeleteAiKey();
  const { data: prefs } = usePreferences();
  const updatePrefs = useUpdatePreferences();
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

        {/* General */}
        <Section title="General">
          {prefs ? (
            <div className="px-4 py-3 rounded-lg bg-ghost border border-wire-2 space-y-3">
              <div>
                <label className="block text-fg-4 text-[10px] font-[510] uppercase tracking-wide mb-1">Timezone</label>
                <TimezoneSelect
                  value={prefs.timezone}
                  onChange={(tz) => {
                    const p = updatePrefs.mutateAsync({ timezone: tz });
                    toast.promise(p, { loading: 'Saving…', success: 'Timezone updated', error: (e) => (e as Error)?.message ?? 'Failed' });
                  }}
                />
                <p className="text-fg-4 text-[11px] mt-1.5">
                  Auto-detected from your browser. Override here if tasks are appearing at the wrong time.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-20 bg-ghost rounded-lg animate-pulse" />
          )}
        </Section>

        {/* Schedule — window templates */}
        <ScheduleSection />

        {/* Blackout blocks */}
        <BlackoutsSection />

        {/* Task defaults */}
        <Section title="Task defaults" description="Applied when you create a new task.">
          {prefs ? (
            <div className="px-4 py-3 rounded-lg bg-ghost border border-wire-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-fg-4 text-[10px] font-[510] uppercase tracking-wide mb-1">Buffer (min)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    defaultValue={prefs.defaultBufferMins}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!isNaN(v) && v !== prefs.defaultBufferMins) {
                        const p = updatePrefs.mutateAsync({ defaultBufferMins: v });
                        toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => (e as Error)?.message ?? 'Failed' });
                      }
                    }}
                    className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-fg-4 text-[10px] font-[510] uppercase tracking-wide mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min={1}
                    defaultValue={prefs.defaultDurationMins ?? ''}
                    placeholder="None"
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const v = raw ? Number(raw) : null;
                      if (v !== prefs.defaultDurationMins) {
                        const p = updatePrefs.mutateAsync({ defaultDurationMins: v });
                        toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => (e as Error)?.message ?? 'Failed' });
                      }
                    }}
                    className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-fg-4 text-[10px] font-[510] uppercase tracking-wide mb-1">Priority</label>
                  <select
                    defaultValue={prefs.defaultPriority}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v !== prefs.defaultPriority) {
                        const p = updatePrefs.mutateAsync({ defaultPriority: v });
                        toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => (e as Error)?.message ?? 'Failed' });
                      }
                    }}
                    className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value={1}>Urgent</option>
                    <option value={2}>High</option>
                    <option value={3}>Normal</option>
                    <option value={4}>Low</option>
                  </select>
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <Toggle
                      checked={prefs.defaultSchedulable}
                      onChange={(v) => {
                        const p = updatePrefs.mutateAsync({ defaultSchedulable: v });
                        toast.promise(p, { loading: 'Saving…', success: 'Saved', error: (e) => (e as Error)?.message ?? 'Failed' });
                      }}
                    />
                    <span className="text-fg-2 text-sm">Auto-schedule by default</span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-24 bg-ghost rounded-lg animate-pulse" />
          )}
        </Section>

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
                  <button
                    onClick={() =>
                      !cal.isWriteCalendar &&
                      toast.promise(
                        updateCalendar.mutateAsync({ id: cal.id, isWriteCalendar: true }),
                        {
                          loading: 'Updating…',
                          success: `Events will be created in ${cal.name}`,
                          error: 'Failed to update',
                        },
                      )
                    }
                    disabled={updateCalendar.isPending || cal.isWriteCalendar}
                    className={[
                      'text-[11px] font-[510] px-2 py-0.5 rounded border transition-colors',
                      cal.isWriteCalendar
                        ? 'border-accent text-accent cursor-default'
                        : 'border-wire text-fg-4 hover:border-accent hover:text-accent',
                    ].join(' ')}
                  >
                    {cal.isWriteCalendar ? 'Write ✓' : 'Write'}
                  </button>
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
          description="Add API keys so you can use models from different providers in Chat."
        >
          <AiKeyManager
            aiKeys={aiKeys}
            isLoading={aiKeysLoading}
            onSave={(provider, key) =>
              toast.promise(setAiKey.mutateAsync({ provider, apiKey: key }), {
                loading: 'Saving key…',
                success: `${PROVIDER_DISPLAY[provider]} key saved`,
                error: (e) => e?.message ?? 'Failed to save key',
              })
            }
            onDelete={(provider) =>
              toast.promise(deleteAiKey.mutateAsync(provider), {
                loading: 'Removing key…',
                success: `${PROVIDER_DISPLAY[provider]} key removed`,
                error: 'Failed to remove key',
              })
            }
            isSaving={setAiKey.isPending}
          />
        </Section>
      </div>
    </div>
  );
}

// ── Timezone select ───────────────────────────────────────────────────────

const AU_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Perth',
  'Australia/Darwin',
  'Australia/Hobart',
  'Australia/Lord_Howe',
];

function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [search, setSearch] = useState('');

  const allZones = useMemo(() => {
    try { return Intl.supportedValuesOf('timeZone'); } catch { return []; }
  }, []);

  const filtered = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return allZones.filter((z) => z.toLowerCase().includes(q)).slice(0, 50);
  }, [search, allZones]);

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        placeholder="Search timezone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent transition-colors"
      />
      <select
        size={6}
        value={value}
        onChange={(e) => { onChange(e.target.value); setSearch(''); }}
        className="w-full bg-surface border border-wire rounded px-2 py-1 text-sm text-fg focus:outline-none focus:border-accent transition-colors"
      >
        {!search && (
          <optgroup label="Australia">
            {AU_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace('Australia/', '')}</option>
            ))}
          </optgroup>
        )}
        {!search && <optgroup label="All timezones">
          {allZones.filter((z) => !AU_TIMEZONES.includes(z)).map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </optgroup>}
        {search && (filtered ?? []).map((tz) => (
          <option key={tz} value={tz}>{tz}</option>
        ))}
        {search && (filtered ?? []).length === 0 && (
          <option disabled>No results</option>
        )}
      </select>
      <p className="text-fg-4 text-[11px]">Current: <span className="text-fg-3 font-[510]">{value}</span></p>
    </div>
  );
}

// ── AI Key Manager sub-component ─────────────────────────────────────────

const PROVIDER_DISPLAY: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };
const PROVIDERS = ['openai', 'anthropic', 'google'] as const;
const KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
  google: 'AIza…',
};

interface AiKeysData {
  keys: { provider: string; hasKey: boolean; updatedAt: string }[];
  envKeys: Record<string, boolean>;
}

function AiKeyManager({
  aiKeys,
  isLoading,
  onSave,
  onDelete,
  isSaving,
}: {
  aiKeys: AiKeysData | undefined;
  isLoading: boolean;
  onSave: (provider: string, key: string) => void;
  onDelete: (provider: string) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');

  if (isLoading) {
    return <div className="h-32 bg-ghost rounded-lg animate-pulse" />;
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map((provider) => {
        const userKey = aiKeys?.keys.find((k) => k.provider === provider);
        const envAvailable = aiKeys?.envKeys[provider] ?? false;
        const isEditing = editing === provider;

        return (
          <div
            key={provider}
            className="px-4 py-3 rounded-lg bg-ghost border border-wire-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-fg-2 text-sm font-[510]">{PROVIDER_DISPLAY[provider]}</span>
                {envAvailable && (
                  <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                    server key
                  </span>
                )}
                {userKey?.hasKey && (
                  <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium">
                    your key
                  </span>
                )}
                {!envAvailable && !userKey?.hasKey && (
                  <span className="text-[10px] bg-surface-3 text-fg-4 px-1.5 py-0.5 rounded-full">
                    not configured
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {userKey?.hasKey && !isEditing && (
                  <button
                    onClick={() => onDelete(provider)}
                    className="text-danger text-[11px] font-[510] hover:text-danger/80 transition-colors"
                  >
                    Remove
                  </button>
                )}
                {!isEditing && (
                  <button
                    onClick={() => {
                      setEditing(provider);
                      setKeyInput('');
                    }}
                    className="text-fg-3 text-[11px] font-[510] hover:text-fg-2 transition-colors"
                  >
                    {userKey?.hasKey ? 'Update' : 'Add key'}
                  </button>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="mt-2.5 flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={KEY_PLACEHOLDERS[provider] ?? 'API key…'}
                  className="flex-1 bg-surface-2 border border-wire rounded-md px-3 py-1.5 text-fg text-xs font-mono placeholder:text-fg-4 focus:outline-none focus:border-accent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && keyInput.length >= 10) {
                      onSave(provider, keyInput);
                      setEditing(null);
                      setKeyInput('');
                    }
                    if (e.key === 'Escape') {
                      setEditing(null);
                      setKeyInput('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (keyInput.length >= 10) {
                      onSave(provider, keyInput);
                      setEditing(null);
                      setKeyInput('');
                    }
                  }}
                  disabled={keyInput.length < 10 || isSaving}
                  className="text-xs font-[510] px-3 py-1.5 rounded-md bg-brand text-white hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(null);
                    setKeyInput('');
                  }}
                  className="text-xs font-[510] px-3 py-1.5 rounded-md bg-surface-3 text-fg-3 hover:text-fg-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-fg-4 text-xs pt-1">
        Your keys are encrypted at rest. They are only used for chat requests you make.
        Server-level keys (set via environment variables) are available to all users.
      </p>
    </div>
  );
}
