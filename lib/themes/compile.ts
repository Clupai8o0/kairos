// lib/themes/compile.ts
import type { ThemeManifest } from './types';

/**
 * Compiles a validated ThemeManifest into a CSS string.
 * Pure function — no IO, fully snapshot-testable.
 *
 * @param manifest - validated theme manifest
 * @param scope - `'@theme'` (default, Tailwind v4 global tokens) or
 *   `'selector'` (scopes tokens under `[data-theme="<id>"]` for
 *   marketplace/custom packs that must not override built-in tokens globally)
 */
export function compileManifest(
  manifest: ThemeManifest,
  scope: '@theme' | 'selector' = '@theme',
): string {
  const tokens = Object.entries(manifest.tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const fonts = (manifest.fontImports ?? [])
    .map((url) => `@import url('${url}');`)
    .join('\n');

  const block =
    scope === 'selector'
      ? `[data-theme="${manifest.id}"] {\n${tokens}\n}\n`
      : `@theme {\n${tokens}\n}\n`;

  return `${fonts ? fonts + '\n' : ''}${block}`;
}
