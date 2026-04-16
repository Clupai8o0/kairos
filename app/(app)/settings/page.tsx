'use client';

import { useCalendars, useToggleCalendar } from '@/lib/hooks/use-calendars';
import { usePlugins, useTogglePlugin } from '@/lib/hooks/use-plugins';
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
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { data: calendars, isLoading: calsLoading } = useCalendars();
  const { data: plugins, isLoading: pluginsLoading } = usePlugins();
  const toggleCalendar = useToggleCalendar();
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
          description="Enable the calendars Kairos reads free/busy from and writes events to."
        >
          {calsLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-12 bg-ghost rounded-lg animate-pulse" />
              ))}
            </div>
          ) : calendars && calendars.length > 0 ? (
            calendars.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-ghost border border-wire-2"
              >
                <div>
                  <p className="text-fg-2 text-sm font-[510]">{cal.name}</p>
                  <p className="text-fg-4 text-xs">{cal.calendarId}</p>
                </div>
                <Toggle
                  checked={cal.selected}
                  onChange={(v) => toggleCalendar.mutate({ id: cal.id, selected: v })}
                  disabled={toggleCalendar.isPending}
                />
              </div>
            ))
          ) : (
            <div className="px-4 py-5 rounded-lg bg-ghost border border-wire-2 text-center">
              <p className="text-fg-4 text-sm">No calendars connected.</p>
              <p className="text-fg-4 text-xs mt-1">
                Calendars sync after Google OAuth grants calendar access. Try visiting{' '}
                <code className="text-accent text-[11px]">/api/calendars/sync</code>.
              </p>
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
