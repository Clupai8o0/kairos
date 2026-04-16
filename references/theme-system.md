# 12 — Theme System

The token contract, packaging formats, and runtime mechanics for design packs. Read `design-system.md` first for the architectural overview. Read `theme-marketplace.md` for distribution.

---

## The two packaging formats

### Built-in packs — CSS files

Built-in packs ship in the repo at `app/styles/packs/<id>.css`. Each is a single file that defines a Tailwind v4 `@theme` block. Compiled at build time, zero runtime cost, full type safety from the Tailwind toolchain.

```
app/styles/packs/
├── obsidian-linear.css     <- the current phase-1 pack
├── parchment.css           <- (future) light pack
└── manifest.ts             <- static registry of built-ins
```

The `manifest.ts` exports a typed array consumed by the theme picker. New built-ins are added by writing the CSS file and appending to `manifest.ts` — that's it.

### Marketplace packs — JSON manifests

Community packs distribute as JSON manifests, validated against a Zod schema. The host compiles the manifest to a CSS string at install time and stores both in the database. The compiled CSS is served from a route handler scoped to the user.

This split exists because forcing a Vercel redeploy for every theme install kills the marketplace UX. JSON manifests install in seconds without touching the build.

---

## The token contract

Every pack — CSS or JSON — must define this token set. Components reference these names; if a pack omits a required token, the host falls back to the default pack's value for that token and emits a warning.

### Required tokens

These are the load-bearing semantic tokens. Components can assume they exist.

| Token | Role |
|---|---|
| `--color-canvas` | Outermost background — body, marketing hero |
| `--color-surface` | Default panel/card background |
| `--color-surface-2` | Elevated surface (modals, dropdowns) |
| `--color-surface-3` | Hover/active surface |
| `--color-fg` | Primary text |
| `--color-fg-2` | Secondary text |
| `--color-fg-3` | Tertiary text (placeholders, metadata) |
| `--color-fg-4` | Quaternary text (timestamps, disabled) |
| `--color-accent` | Primary interactive accent |
| `--color-accent-hover` | Accent hover state |
| `--color-line` | Default border |
| `--color-line-subtle` | Subtle divider |
| `--color-success` | Success/positive status |
| `--color-warning` | Warning/caution status |
| `--color-danger` | Error/destructive status |
| `--font-sans` | Primary UI font stack |
| `--font-mono` | Monospace font stack |
| `--radius-sm` | Small radius (buttons, chips) |
| `--radius-md` | Medium radius (cards, inputs) |
| `--radius-lg` | Large radius (modals, popovers) |

### Optional tokens

Packs may extend the system with additional tokens. Components that use optional tokens must check for presence and have a fallback. Examples currently in use by the Linear-inspired pack: `--color-brand`, `--color-ghost`, `--color-ghost-2`, `--color-wire`, `--color-emerald`. These are valid but not required of every pack.

### Banned in components

Components must never reference:
- Raw Tailwind colour utilities (`bg-zinc-900`, `text-slate-200`)
- Hex literals in JSX or CSS Module files
- RGB/HSL/OKLCH literals outside of pack files

Enforced via the ESLint rule below. Pack files (`app/styles/packs/*.css`) and the compiled marketplace CSS are the only places literal colour values are allowed.

---

## ESLint rule: ban raw colours in components

Add to `eslint-rules/no-raw-colors.js` and wire into `eslint.config.mjs`. Sketch:

```js
// eslint-rules/no-raw-colors.js
const TAILWIND_COLOR_RE = /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FN_RE = /\b(rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/;

const ALLOWED_PATHS = [
  /app\/styles\/packs\//,
  /lib\/themes\/compiled\//,
];

module.exports = {
  meta: { type: 'problem', docs: { description: 'Ban raw colours outside theme pack files' } },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWED_PATHS.some((re) => re.test(filename))) return {};
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (TAILWIND_COLOR_RE.test(node.value) || HEX_RE.test(node.value) || COLOR_FN_RE.test(node.value)) {
          context.report({ node, message: 'Raw colour literal — use a semantic token from the active theme pack.' });
        }
      },
    };
  },
};
```

This is the load-bearing piece. Without it, packs become decorative — components still reference Tailwind colours and pack swaps don't change anything visible.

---

## JSON manifest schema

Marketplace packs are validated against this Zod schema before install:

```typescript
// lib/themes/types.ts
import { z } from 'zod';

const ColorValue = z.string().regex(
  /^(#[0-9a-fA-F]{3,8}|rgba?\(.+\)|hsla?\(.+\)|oklch\(.+\)|oklab\(.+\))$/,
  'Must be a valid CSS color value',
);

const RequiredTokens = z.object({
  '--color-canvas': ColorValue,
  '--color-surface': ColorValue,
  '--color-surface-2': ColorValue,
  '--color-surface-3': ColorValue,
  '--color-fg': ColorValue,
  '--color-fg-2': ColorValue,
  '--color-fg-3': ColorValue,
  '--color-fg-4': ColorValue,
  '--color-accent': ColorValue,
  '--color-accent-hover': ColorValue,
  '--color-line': ColorValue,
  '--color-line-subtle': ColorValue,
  '--color-success': ColorValue,
  '--color-warning': ColorValue,
  '--color-danger': ColorValue,
  '--font-sans': z.string(),
  '--font-mono': z.string(),
  '--radius-sm': z.string(),
  '--radius-md': z.string(),
  '--radius-lg': z.string(),
});

export const ThemeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(64),
  description: z.string().max(280),
  author: z.string().max(64),
  homepage: z.string().url().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  colorScheme: z.enum(['light', 'dark', 'system']),
  preview: z.object({
    canvas: ColorValue,
    surface: ColorValue,
    fg: ColorValue,
    accent: ColorValue,
  }),
  tokens: RequiredTokens.catchall(z.string()),
  fontImports: z.array(z.string().url()).max(8).optional(),
});

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;
```

Manifest constraints worth calling out:
- `id` is lowercase-kebab and globally unique within the marketplace
- `version` is semver — the registry refuses installs of duplicate `id@version`
- `preview` is a 4-token subset used to render the marketplace card without compiling the full pack
- `fontImports` URLs are validated against an allowlist of known font hosts (`fonts.googleapis.com`, `rsms.me`, `cdn.jsdelivr.net`) at install time
- `catchall(z.string())` allows optional/extended tokens beyond the required set, but every value must be a string

---

## Compiling JSON to CSS

The host compiles a manifest to a CSS string when the user installs it:

```typescript
// lib/themes/compile.ts
export function compileManifest(manifest: ThemeManifest): string {
  const tokens = Object.entries(manifest.tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const fonts = (manifest.fontImports ?? [])
    .map((url) => `@import url('${url}');`)
    .join('\n');
  return `${fonts}\n@theme {\n${tokens}\n}\n`;
}
```

The compiled CSS is stored in `themeInstalls.compiledCss` (see `theme-marketplace.md` for the schema) and served from `app/api/themes/[id]/css/route.ts` with long cache headers keyed on `id@version`.

---

## Runtime: how a pack becomes active

### Loading

The root `app/layout.tsx` reads `users.activeThemeId` server-side and either:
- For built-ins: imports the static CSS file (Tailwind handles bundling)
- For marketplace packs: injects a `<link rel="stylesheet" href="/api/themes/{installId}/css">` tag

This means the pack arrives as part of the initial HTML response — no FOUC, no JS-driven theme flip on hydration. The cost is one server-side DB read per page load, which is already happening for auth.

### Switching

Two surfaces:

1. **Settings panel** (`app/(app)/settings/appearance/page.tsx`) — visual grid of installed packs with preview cards rendered from `preview` tokens. Selecting one calls `PATCH /api/me/theme { themeId }` and reloads the page.
2. **Command palette** (`Cmd+K -> "Theme: <name>"`) — same backing endpoint. Live preview as you arrow through (changes are local CSS variable swaps in the document head; commit on enter persists to DB).

### Persistence

```sql
ALTER TABLE users ADD COLUMN active_theme_id text NOT NULL DEFAULT 'obsidian-linear';
```

That's the entire phase-2 schema change. No `themes` table yet — built-ins are statically registered in `app/styles/packs/manifest.ts`. The `themeInstalls` table only appears in phase 4 when marketplace packs become installable.

---

## Plugin packs

A plugin's `manifest.json` may declare a `theme` field pointing to a JSON manifest. When the plugin is installed, the host validates and compiles the pack alongside the plugin install. The pack appears in the user's theme picker with a "via plugin" badge. Uninstalling the plugin removes the pack (and reverts `activeThemeId` to default if the user had it active).

This gives plugin authors a way to ship a coordinated visual identity (e.g. an Obsidian-clone plugin shipping an Obsidian-clone pack) without going through the theme marketplace separately.

---

## What lives where — the import map

| File / package | May import | May NOT import |
|---|---|---|
| `app/styles/packs/*.css` | nothing (just CSS) | — |
| `app/styles/packs/manifest.ts` | pack metadata types | runtime DB code |
| `lib/themes/types.ts` | Zod | anything else |
| `lib/themes/compile.ts` | `lib/themes/types` | DB schema, route helpers |
| `lib/themes/runtime.ts` | DB schema (`users` only in phase 2; `themeInstalls` in phase 4) | LLM SDKs, plugin host |
| Components anywhere | semantic token utilities only | raw Tailwind colours, hex literals (ESLint-enforced) |

---

## Test coverage

- Unit: `compileManifest` snapshot test (manifest in -> CSS out, byte-identical)
- Unit: `ThemeManifestSchema` accepts the current Linear-inspired pack converted to JSON; rejects manifests missing required tokens
- Unit: ESLint rule passes on a known-good component, fails on a known-bad one (uses `bg-zinc-900`)
- Integration: `PATCH /api/me/theme` updates `users.activeThemeId` and the next request renders with the new pack
- Integration (phase 4): installing a marketplace manifest writes a `themeInstalls` row, and the served `/api/themes/{installId}/css` returns the compiled CSS

---

## Phase mapping

| Phase | Theme system work |
|---|---|
| 1 | Done — Linear-inspired pack at `@theme`, Tailwind v4 set up |
| 2 | Token contract codified, ESLint rule shipped, `users.activeThemeId` added, settings panel + command palette switcher, second built-in pack (light) |
| 3 | OSS launch — token contract documented for contributors, "how to write a theme pack" page in docs |
| 4 | Marketplace — `themeInstalls` table, install flow, registry submission, in-app browser. See `theme-marketplace.md`. |
