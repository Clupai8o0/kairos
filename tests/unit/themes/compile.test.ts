// tests/unit/themes/compile.test.ts
import { describe, it, expect } from 'vitest';
import { compileManifest } from '@/lib/themes/compile';
import type { ThemeManifest } from '@/lib/themes/types';

const BASE_MANIFEST: ThemeManifest = {
  schemaVersion: 1,
  id: 'test-dark',
  name: 'Test Dark',
  description: 'A minimal test pack',
  author: 'Kairos',
  version: '1.0.0',
  colorScheme: 'dark',
  preview: {
    canvas: '#08090a',
    surface: '#0f1011',
    fg: '#f7f8f8',
    accent: '#7170ff',
  },
  tokens: {
    '--color-canvas': '#08090a',
    '--color-surface': '#0f1011',
    '--color-surface-2': '#191a1b',
    '--color-surface-3': '#28282c',
    '--color-fg': '#f7f8f8',
    '--color-fg-2': '#d0d6e0',
    '--color-fg-3': '#8a8f98',
    '--color-fg-4': '#62666d',
    '--color-accent': '#7170ff',
    '--color-accent-hover': '#8585ff',
    '--color-line': '#23252a',
    '--color-line-subtle': '#34343a',
    '--color-success': '#27a644',
    '--color-warning': '#f59e0b',
    '--color-danger': '#ef4444',
    '--font-sans': 'Inter, sans-serif',
    '--font-mono': 'monospace',
    '--radius-sm': '0.375rem',
    '--radius-md': '0.5rem',
    '--radius-lg': '0.75rem',
  },
};

describe('compileManifest', () => {
  it('produces a @theme block with all tokens', () => {
    const css = compileManifest(BASE_MANIFEST);
    expect(css).toContain('@theme {');
    expect(css).toContain('  --color-canvas: #08090a;');
    expect(css).toContain('  --radius-sm: 0.375rem;');
  });

  it('matches snapshot (byte-identical)', () => {
    expect(compileManifest(BASE_MANIFEST)).toMatchSnapshot();
  });

  it('prepends font imports when present', () => {
    const css = compileManifest({
      ...BASE_MANIFEST,
      fontImports: ['https://fonts.googleapis.com/css2?family=Inter'],
    });
    expect(css).toContain("@import url('https://fonts.googleapis.com/css2?family=Inter');");
    expect(css.indexOf('@import')).toBeLessThan(css.indexOf('@theme'));
  });

  it('produces no @import line when fontImports is absent', () => {
    const css = compileManifest(BASE_MANIFEST);
    expect(css).not.toContain('@import url');
  });
});
