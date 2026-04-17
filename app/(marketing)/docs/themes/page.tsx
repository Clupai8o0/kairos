export const metadata = { title: 'Kairos Docs — Authoring Themes' };

const MANIFEST_EXAMPLE = `{
  "schemaVersion": 1,
  "id": "my-theme",
  "name": "My Theme",
  "description": "A custom Kairos theme.",
  "author": "Your Name",
  "version": "1.0.0",
  "colorScheme": "dark",
  "preview": {
    "canvas": "#1a1b1e",
    "surface": "#25262b",
    "fg": "#c1c2c5",
    "accent": "#7c3aed"
  },
  "tokens": {
    "--color-canvas": "#1a1b1e",
    "--color-surface": "#25262b",
    "--color-surface-2": "#2c2e33",
    "--color-surface-3": "#373a40",
    "--color-fg": "#c1c2c5",
    "--color-fg-2": "#a6a7ab",
    "--color-fg-3": "#909296",
    "--color-fg-4": "#5c5f66",
    "--color-accent": "#7c3aed",
    "--color-accent-hover": "#6d28d9",
    "--color-line": "#373a40",
    "--color-line-subtle": "#2c2e33",
    "--color-success": "#2f9e44",
    "--color-warning": "#e67700",
    "--color-danger": "#e03131",
    "--font-sans": "system-ui, sans-serif",
    "--font-mono": "ui-monospace, monospace",
    "--radius-sm": "0.25rem",
    "--radius-md": "0.375rem",
    "--radius-lg": "0.5rem"
  }
}`;

const REQUIRED_TOKENS = [
  ['--color-canvas', 'Page background'],
  ['--color-surface', 'Card / panel background'],
  ['--color-surface-2', 'Slightly elevated surface (input backgrounds)'],
  ['--color-surface-3', 'Further elevated surface (hover states, badges)'],
  ['--color-fg', 'Primary text'],
  ['--color-fg-2', 'Secondary text'],
  ['--color-fg-3', 'Muted text (labels, descriptions)'],
  ['--color-fg-4', 'Placeholder / disabled text'],
  ['--color-accent', 'Primary interactive colour (buttons, links, focus rings)'],
  ['--color-accent-hover', 'Accent hover state'],
  ['--color-line', 'Primary border colour'],
  ['--color-line-subtle', 'Subtle border (dividers)'],
  ['--color-success', 'Success state'],
  ['--color-warning', 'Warning state'],
  ['--color-danger', 'Error / destructive action'],
  ['--font-sans', 'Sans-serif font stack'],
  ['--font-mono', 'Monospace font stack'],
  ['--radius-sm', 'Small corner radius'],
  ['--radius-md', 'Medium corner radius'],
  ['--radius-lg', 'Large corner radius'],
];

export default function ThemesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-[600] text-fg mb-2">Authoring themes</h1>
        <p className="text-fg-3 text-base leading-relaxed">
          A Kairos theme is a JSON manifest declaring 20 semantic tokens. The app compiles it to CSS at install time.
          No CSS knowledge required — just pick colours, fonts, and radii that match your visual identity.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Manifest format</h2>
        <p className="text-fg-3 text-sm">A complete theme manifest — copy, modify, and paste into the custom theme uploader:</p>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto leading-relaxed"><code>{MANIFEST_EXAMPLE}</code></pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Required tokens</h2>
        <p className="text-fg-3 text-sm">All 20 tokens below are required. A manifest missing any of them will fail validation.</p>
        <div className="rounded-lg border border-wire-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ghost">
              <tr>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">Token</th>
                <th className="px-4 py-2 text-left text-fg-4 font-[510] text-xs uppercase tracking-wide">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wire-2">
              {REQUIRED_TOKENS.map(([token, role]) => (
                <tr key={token} className="hover:bg-ghost transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-accent">{token}</td>
                  <td className="px-4 py-2 text-xs text-fg-4">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Optional tokens</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          You can extend the manifest with any additional CSS custom properties — just add them to the <code className="text-accent">tokens</code> object.
          Common optional tokens:
        </p>
        <ul className="space-y-1.5 text-sm">
          {[
            ['--color-brand', 'Brand colour (defaults to accent if unset)'],
            ['--color-accent-2', 'Secondary accent colour'],
            ['--color-emerald', 'Emerald/green accent'],
            ['--color-task-event-bg', 'Background colour for calendar task events'],
            ['--radius-xl', 'Extra-large corner radius'],
            ['--shadow-sm / --shadow-md / --shadow-lg', 'Box shadow tokens'],
            ['--duration-fast / --duration-normal / --duration-slow', 'Animation duration tokens'],
          ].map(([token, desc]) => (
            <li key={token} className="flex gap-3">
              <code className="text-accent text-xs shrink-0">{token}</code>
              <span className="text-fg-4 text-xs">{desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Color value formats</h2>
        <p className="text-fg-3 text-sm">Color token values must be valid CSS color expressions:</p>
        <ul className="space-y-1 text-sm text-fg-3">
          {['#1a1b1e', 'rgb(26, 27, 30)', 'rgba(255, 255, 255, 0.08)', 'hsl(240 5% 12%)', 'oklch(15% 0.01 270)', 'oklab(0.15 -0.01 -0.01)'].map((v) => (
            <li key={v}><code className="text-accent text-xs">{v}</code></li>
          ))}
        </ul>
        <p className="text-fg-4 text-xs">Note: keyword colours like <code>red</code> or <code>transparent</code> are not accepted.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Font imports</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          To use a web font, add its <code className="text-accent">@import</code> URL to the <code className="text-accent">fontImports</code> array.
          Only fonts from these sources are allowed:
        </p>
        <ul className="space-y-1 text-sm text-fg-3">
          {['fonts.googleapis.com', 'rsms.me', 'cdn.jsdelivr.net'].map((host) => (
            <li key={host}><code className="text-accent text-xs">{host}</code></li>
          ))}
        </ul>
        <pre className="text-[12px] text-fg-3 bg-surface rounded-md p-4 overflow-x-auto"><code>{`"fontImports": [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
],
"tokens": {
  "--font-sans": "'Inter', system-ui, sans-serif",
  ...
}`}</code></pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Install your theme</h2>
        <p className="text-fg-3 text-sm leading-relaxed">
          Go to <strong className="text-fg-2">Settings → Appearance → Upload custom theme</strong>, paste your manifest JSON, and click &quot;Install&quot;.
          The theme will appear in your pack picker immediately.
        </p>
        <p className="text-fg-3 text-sm">
          To share your theme with the community, submit a PR to the{' '}
          <a href="https://github.com/kairos-app/kairos-themes-registry" className="text-accent hover:text-accent-hover transition-colors" target="_blank" rel="noopener noreferrer">
            kairos-themes-registry
          </a>{' '}
          repository.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-fg font-[510] text-base">Safety checks</h2>
        <p className="text-fg-3 text-sm leading-relaxed">Every manifest goes through these checks before install:</p>
        <ul className="space-y-1.5 text-sm text-fg-4">
          {[
            'Schema validation — all required fields present and correctly typed',
            'Size limit — raw JSON must be under 64KB',
            'CSS injection scan — compiled CSS is scanned for @import outside the font allowlist, expression(), behavior:, and javascript: URIs',
            'Font allowlist — fontImports must point to approved CDNs',
            'ID uniqueness — theme ID must not collide with a built-in pack',
            'Token completeness — all 20 required tokens must be present',
          ].map((check) => (
            <li key={check} className="flex gap-2">
              <span className="text-success shrink-0 mt-0.5">✓</span>
              <span>{check}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
