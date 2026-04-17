export const metadata = { title: 'Kairos Docs — Overview' };

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-[600] text-fg mb-2">Kairos Documentation</h1>
        <p className="text-fg-3 text-base leading-relaxed">
          Kairos is an AI-native scheduling app you can self-host, extend with plugins, and theme to your taste.
          These docs cover building plugins, authoring themes, and calling the API.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            href: '/docs/plugins',
            title: 'Building plugins',
            desc: 'Create a scratchpad plugin that extracts tasks from any source — URLs, files, voice memos.',
          },
          {
            href: '/docs/themes',
            title: 'Authoring themes',
            desc: 'Design a full visual identity by declaring 20 semantic tokens in a JSON manifest.',
          },
          {
            href: '/docs/api',
            title: 'API reference',
            desc: 'Integrate Kairos from agents, n8n, or any HTTP client via the REST API.',
          },
        ].map(({ href, title, desc }) => (
          <a
            key={href}
            href={href}
            className="block p-4 rounded-lg border border-wire-2 hover:border-wire bg-ghost hover:bg-ghost-2 transition-colors group"
          >
            <p className="text-fg-2 font-[510] text-sm mb-1 group-hover:text-fg transition-colors">{title}</p>
            <p className="text-fg-4 text-xs leading-relaxed">{desc}</p>
          </a>
        ))}
      </div>

      <div className="rounded-lg border border-wire-2 bg-ghost p-5 space-y-3">
        <h2 className="text-fg-2 font-[510] text-sm">Quick start: self-host in 5 minutes</h2>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto leading-relaxed"><code>{`# 1. Clone the repo
git clone https://github.com/kairos-app/kairos && cd kairos

# 2. Copy env template and fill in your credentials
cp .env.local.example .env.local

# 3. Start with Docker
docker compose up -d

# 4. Open http://localhost:3000`}</code></pre>
        <p className="text-fg-4 text-xs">
          See the <a href="/docs/plugins" className="text-accent hover:text-accent-hover transition-colors">CONTRIBUTING.md</a> for the full setup guide including Google OAuth.
        </p>
      </div>

      <div className="rounded-lg border border-wire-2 bg-ghost p-5">
        <h2 className="text-fg-2 font-[510] text-sm mb-2">Architecture in one paragraph</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          Kairos is a single Next.js 16 app (App Router). Tasks, tags, and schedule windows live in a Postgres database via Drizzle.
          Google Calendar is the <em>only</em> time store — tasks store a <code className="text-accent">gcalEventId</code> and a denormalised <code className="text-accent">scheduledAt</code> cache.
          The scratchpad is a plugin host: it receives input (text, URLs, voice), dispatches to whichever plugin claims it, and returns candidate tasks for the user to review before committing.
          Background scheduling runs through a Postgres <code className="text-accent">jobs</code> table drained by Vercel Cron.
        </p>
      </div>
    </div>
  );
}
