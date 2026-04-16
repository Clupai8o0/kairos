'use client';

import { useCalendars, useToggleCalendar } from '@/lib/hooks/use-calendars';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: calendars, isLoading: calsLoading } = useCalendars();
  const toggleCalendar = useToggleCalendar();
  const { data: session } = authClient.useSession();
  const router = useRouter();

  function handleSignOut() {
    authClient.signOut({ fetchOptions: { onSuccess: () => router.push('/') } });
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
        <Section title="Google Calendars">
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
                <button
                  onClick={() => toggleCalendar.mutate({ id: cal.id, selected: !cal.selected })}
                  className={[
                    'relative w-9 h-5 rounded-full transition-colors',
                    cal.selected ? 'bg-brand' : 'bg-surface-3',
                  ].join(' ')}
                  aria-label={cal.selected ? 'Deselect calendar' : 'Select calendar'}
                >
                  <span
                    className={[
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      cal.selected ? 'translate-x-4' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </button>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 rounded-lg bg-ghost border border-wire-2 text-center">
              <p className="text-fg-4 text-sm">No calendars connected.</p>
              <p className="text-fg-4 text-xs mt-1">
                Calendars appear here after Google OAuth grants calendar access.
              </p>
            </div>
          )}
        </Section>

        {/* LLM Provider — placeholder for Phase 2 */}
        <Section title="AI Provider">
          <div className="px-4 py-4 rounded-lg bg-ghost border border-wire-2">
            <p className="text-fg-3 text-sm font-[510] mb-1">LLM configuration</p>
            <p className="text-fg-4 text-xs">
              Configure your AI provider (OpenAI, Anthropic, or Ollama) here. Coming in the next session.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
