#!/usr/bin/env node
// packages/theme-validator/src/cli.ts
import { readInput, resolveGlob } from '@kairos/validator-core/fs';
import { formatHuman, formatJson, exitCodeFor } from '@kairos/validator-core/output';
import type { FileResult, ValidationSummary } from '@kairos/validator-core/types';
import { z } from 'zod';

const PreviewSchema = z.object({
  canvas: z.string(),
  surface: z.string(),
  fg: z.string(),
  accent: z.string(),
});

const FontRefSchema = z.object({
  family: z.string(),
  weight: z.union([z.string(), z.number()]).optional(),
  source: z.string().url().optional(),
});

const ThemeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1).max(64),
  description: z.string().min(10).max(500),
  author: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  colorScheme: z.enum(['dark', 'light']),
  preview: PreviewSchema,
  tokens: z.record(z.string(), z.string()),
  fonts: z.array(FontRefSchema).default([]),
  css: z.string().optional(),
  provenance: z.string().url().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
});

const FONT_ALLOWLIST = ['fonts.googleapis.com', 'rsms.me', 'cdn.jsdelivr.net'];
const MAX_MANIFEST_BYTES = 64 * 1024;

function validateThemeManifest(content: string, filePath: string): FileResult {
  const issues: FileResult['issues'] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      file: filePath,
      issues: [{ level: 'error', message: 'Invalid JSON', path: '' }],
    };
  }

  const result = ThemeManifestSchema.safeParse(parsed);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        level: 'error',
        message: issue.message,
        path: issue.path.join('.'),
      });
    }
  } else {
    const m = result.data;

    // Size check
    if (new TextEncoder().encode(content).length > MAX_MANIFEST_BYTES) {
      issues.push({ level: 'error', message: 'Manifest exceeds 64KB size limit', path: '' });
    }

    // Font source allowlist
    for (const font of m.fonts) {
      if (font.source) {
        try {
          const url = new URL(font.source);
          if (!FONT_ALLOWLIST.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
            issues.push({
              level: 'error',
              message: `Font source "${font.source}" not on allowlist: ${FONT_ALLOWLIST.join(', ')}`,
              path: 'fonts',
            });
          }
        } catch {
          issues.push({ level: 'error', message: `Invalid font URL: ${font.source}`, path: 'fonts' });
        }
      }
    }

    // CSS injection check
    if (m.css) {
      const dangerous = /@import|url\s*\(|expression\s*\(|javascript:|behavior\s*:/i;
      if (dangerous.test(m.css)) {
        issues.push({ level: 'error', message: 'CSS contains potentially unsafe patterns', path: 'css' });
      }
    }

    // Warnings
    if (!m.provenance) {
      issues.push({ level: 'warning', message: 'Missing provenance URL', path: 'provenance' });
    }
    if (!m.homepage) {
      issues.push({ level: 'warning', message: 'Missing homepage URL', path: 'homepage' });
    }

    // Token checks
    const requiredTokens = ['canvas', 'surface', 'fg', 'accent', 'brand'];
    for (const token of requiredTokens) {
      if (!m.tokens[token]) {
        issues.push({ level: 'warning', message: `Missing recommended token: ${token}`, path: `tokens.${token}` });
      }
    }
  }

  return { file: filePath, issues };
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const paths = args.filter((a) => !a.startsWith('--'));

  const files = paths.length > 0
    ? await resolveGlob(paths)
    : [{ path: 'stdin', content: await readInput() }];

  const results: FileResult[] = [];
  for (const file of files) {
    const content = 'content' in file ? file.content : await readInput(file.path);
    results.push(validateThemeManifest(content, file.path));
  }

  const summary: ValidationSummary = {
    total: results.length,
    passed: results.filter((r) => r.issues.every((i) => i.level !== 'error')).length,
    failed: results.filter((r) => r.issues.some((i) => i.level === 'error')).length,
    warnings: results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warning').length, 0),
    results,
  };

  console.log(jsonOutput ? formatJson(summary) : formatHuman(summary));
  process.exit(exitCodeFor(summary));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});