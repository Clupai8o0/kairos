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
