import Link from 'next/link';

const DOC_LINKS = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/plugins', label: 'Building plugins' },
  { href: '/docs/themes', label: 'Authoring themes' },
  { href: '/docs/api', label: 'API reference' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-line-subtle">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="w-5 h-5 rounded bg-brand flex items-center justify-center text-white text-[10px] font-semibold">K</span>
            <span className="text-fg-2 text-sm font-[510]">Kairos</span>
          </Link>
          <span className="text-fg-4">/</span>
          <span className="text-fg-3 text-sm">Docs</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar */}
        <aside className="shrink-0 w-44">
          <nav className="sticky top-24 space-y-0.5">
            {DOC_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="block px-3 py-1.5 rounded text-sm text-fg-3 hover:text-fg-2 hover:bg-ghost transition-colors"
              >
                {label}
              </Link>
            ))}
            <div className="mt-6 pt-4 border-t border-wire-2">
              <p className="px-3 text-[11px] font-[510] uppercase tracking-wide text-fg-4 mb-2">External</p>
              <a
                href="https://github.com/kairos-app/kairos"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-1.5 rounded text-sm text-fg-4 hover:text-fg-2 hover:bg-ghost transition-colors"
              >
                GitHub →
              </a>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 prose prose-sm max-w-none [--tw-prose-body:var(--color-fg-2)] [--tw-prose-headings:var(--color-fg)] [--tw-prose-code:var(--color-accent)] [--tw-prose-links:var(--color-accent)]">
          {children}
        </main>
      </div>
    </div>
  );
}
