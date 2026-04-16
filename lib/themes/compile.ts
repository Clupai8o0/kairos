// lib/themes/compile.ts
import type { ThemeManifest } from './types';

/**
 * Compiles a validated ThemeManifest into a CSS string.
 * Pure function — no IO, fully snapshot-testable.
 */
export function compileManifest(manifest: ThemeManifest): string {
  const tokens = Object.entries(manifest.tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const fonts = (manifest.fontImports ?? [])
    .map((url) => `@import url('${url}');`)
    .join('\n');
  return `${fonts ? fonts + '\n' : ''}@theme {\n${tokens}\n}\n`;
}
