// tests/unit/themes/types.test.ts
import { describe, it, expect } from 'vitest';
import { ThemeManifestSchema, type ThemeManifest } from '@/lib/themes/types';

const VALID: ThemeManifest = {
  schemaVersion: 1,
  id: 'obsidian-linear',
  name: 'Obsidian Linear',
  description: 'Dark Linear-inspired pack',
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

describe('ThemeManifestSchema', () => {
  it('accepts a fully valid manifest', () => {
    expect(ThemeManifestSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts optional fontImports', () => {
    const result = ThemeManifestSchema.safeParse({
      ...VALID,
      fontImports: ['https://fonts.googleapis.com/css2?family=Inter'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional homepage', () => {
    const result = ThemeManifestSchema.safeParse({
      ...VALID,
      homepage: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-kebab id', () => {
    const result = ThemeManifestSchema.safeParse({ ...VALID, id: 'My Theme!' });
    expect(result.success).toBe(false);
  });

  it('rejects non-semver version', () => {
    const result = ThemeManifestSchema.safeParse({ ...VALID, version: '1.0' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid color value in tokens', () => {
    const result = ThemeManifestSchema.safeParse({
      ...VALID,
      tokens: { ...VALID.tokens, '--color-canvas': 'not-a-color' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects manifest missing a required token', () => {
    const { '--color-danger': _removed, ...tokensWithout } = VALID.tokens as Record<string, string>;
    const result = ThemeManifestSchema.safeParse({ ...VALID, tokens: tokensWithout });
    expect(result.success).toBe(false);
  });

  it('allows extra optional tokens beyond the required set', () => {
    const result = ThemeManifestSchema.safeParse({
      ...VALID,
      tokens: { ...VALID.tokens, '--color-brand': '#5e6ad2' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects schemaVersion != 1', () => {
    const result = ThemeManifestSchema.safeParse({ ...VALID, schemaVersion: 2 });
    expect(result.success).toBe(false);
  });
});
