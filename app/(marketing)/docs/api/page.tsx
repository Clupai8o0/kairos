export const metadata = { title: 'Kairos Docs — API Reference' };

const ENDPOINTS = [
  {
    group: 'Tasks',
    routes: [
      { method: 'GET', path: '/api/tasks', desc: 'List tasks (supports ?status=, ?tagId= filters)' },
      { method: 'POST', path: '/api/tasks', desc: 'Create a task. Schedule-on-write: auto-places into GCal.' },
      { method: 'GET', path: '/api/tasks/:id', desc: 'Get a single task with tags' },
      { method: 'PATCH', path: '/api/tasks/:id', desc: 'Update a task' },
      { method: 'DELETE', path: '/api/tasks/:id', desc: 'Delete a task and its GCal event' },
    ],
  },
  {
    group: 'Tags',
    routes: [
      { method: 'GET', path: '/api/tags', desc: 'List all tags' },
      { method: 'POST', path: '/api/tags', desc: 'Create a tag' },
      { method: 'PATCH', path: '/api/tags/:id', desc: 'Update a tag' },
      { method: 'DELETE', path: '/api/tags/:id', desc: 'Delete a tag' },
    ],
  },
  {
    group: 'Schedule',
    routes: [
      { method: 'GET', path: '/api/schedule/windows', desc: 'List schedule windows' },
      { method: 'PUT', path: '/api/schedule/windows', desc: 'Replace all schedule windows' },
      { method: 'POST', path: '/api/schedule/run', desc: 'Enqueue a full schedule run (chunked jobs)' },
    ],
  },
  {
    group: 'Scratchpad',
    routes: [
      { method: 'GET', path: '/api/scratchpad', desc: 'List scratchpad entries' },
      { method: 'POST', path: '/api/scratchpad', desc: 'Create a scratchpad entry' },
      { method: 'POST', path: '/api/scratchpad/:id/process', desc: 'Dispatch to plugin, returns candidate tasks' },
      { method: 'POST', path: '/api/scratchpad/:id/commit', desc: 'Create tasks from candidates + auto-schedule' },
      { method: 'DELETE', path: '/api/scratchpad/:id', desc: 'Delete a scratchpad entry' },
    ],
  },
  {
    group: 'Plugins',
    routes: [
      { method: 'GET', path: '/api/plugins', desc: 'List installed plugins with enabled state' },
      { method: 'GET', path: '/api/plugins/:name', desc: 'Get plugin details + config' },
      { method: 'PATCH', path: '/api/plugins/:name', desc: 'Update plugin config or enable/disable' },
    ],
  },
  {
    group: 'Themes',
    routes: [
      { method: 'GET', path: '/api/themes/installed', desc: 'List user\'s installed marketplace themes' },
      { method: 'POST', path: '/api/themes/install', desc: 'Install a theme from registry URL or raw manifest' },
      { method: 'DELETE', path: '/api/themes/:installId', desc: 'Uninstall a marketplace theme' },
      { method: 'GET', path: '/api/themes/:installId/css', desc: 'Serve compiled theme CSS (cached)' },
      { method: 'PATCH', path: '/api/me/theme', desc: 'Set active theme pack ID' },
    ],
  },
  {
    group: 'Calendars',
    routes: [
      { method: 'GET', path: '/api/calendars', desc: 'List connected Google Calendars' },
      { method: 'PATCH', path: '/api/calendars/:id', desc: 'Update calendar selected/showAsBusy flags' },
      { method: 'POST', path: '/api/calendars/sync', desc: 'Sync calendar list from Google' },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald',
  POST: 'text-accent',
  PATCH: 'text-warning',
  PUT: 'text-warning',
  DELETE: 'text-danger',
};

export default function ApiPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-[600] text-fg mb-2">API reference</h1>
        <p className="text-fg-3 text-base leading-relaxed">
          All endpoints require an authenticated session (cookie) or a Bearer API key.
          Responses are JSON. Errors return <code className="text-accent">{"{ error: string }"}</code>.
        </p>
      </div>

      <div className="rounded-lg border border-wire-2 bg-ghost p-4 space-y-2">
        <p className="text-fg-3 text-sm font-[510]">Base URL</p>
        <code className="text-accent text-sm">https://your-kairos-instance.com</code>
        <p className="text-fg-4 text-xs mt-1">All paths below are relative to your deployment URL.</p>
      </div>

      {ENDPOINTS.map(({ group, routes }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-fg font-[510] text-base">{group}</h2>
          <div className="rounded-lg border border-wire-2 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-wire-2">
                {routes.map(({ method, path, desc }) => (
                  <tr key={`${method}${path}`} className="hover:bg-ghost transition-colors">
                    <td className="px-4 py-2.5 w-16">
                      <span className={`font-mono text-xs font-[600] ${METHOD_COLORS[method] ?? 'text-fg-3'}`}>{method}</span>
                    </td>
                    <td className="px-4 py-2.5 w-64">
                      <code className="text-fg-2 text-xs">{path}</code>
                    </td>
                    <td className="px-4 py-2.5 text-fg-4 text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Authentication</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          Session cookies are set automatically after Google OAuth sign-in.
          For headless clients (agents, n8n, CLI), add an <code className="text-accent">Authorization: Bearer &lt;key&gt;</code> header.
          API keys are managed via Better Auth&apos;s built-in key management (coming soon to the Settings UI).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Rate limits</h2>
        <p className="text-fg-3 text-sm">No rate limits in self-hosted mode. Hosted mode (kairos.app) enforces per-user limits.</p>
      </section>
    </div>
  );
}
