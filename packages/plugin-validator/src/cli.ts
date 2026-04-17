#!/usr/bin/env node
// packages/plugin-validator/src/cli.ts
import { readInput, resolveGlob } from '@kairos/validator-core/fs';
import { formatHuman, formatJson, exitCodeFor } from '@kairos/validator-core/output';
import type { FileResult, ValidationSummary } from '@kairos/validator-core/types';
import { z } from 'zod';

const PluginManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1).max(64),
  description: z.string().min(10).max(500),
  author: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  distribution: z.enum(['http', 'bundled']),
  endpoint: z.string().url().optional(),
  npmPackage: z.string().optional(),
  handlesInputTypes: z.array(z.enum(['text', 'url', 'share', 'voice', 'file'])).min(1),
  capabilities: z.array(z.enum(['llm', 'http-fetch', 'file-read'])).default([]),
  configSchema: z.record(z.unknown()).optional(),
  defaultConfig: z.record(z.unknown()).optional(),
  theme: z.record(z.unknown()).optional(),
  provenance: z.string().url().optional(),
  icon: z.string().url().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  changelog: z.string().optional(),
}).refine(
  (m) => m.distribution !== 'http' || !!m.endpoint,
  { message: 'HTTP plugins must provide an endpoint URL' },
).refine(
  (m) => m.distribution !== 'bundled' || !!m.npmPackage,
  { message: 'Bundled plugins must provide an npmPackage name' },
);

function validatePluginManifest(content: string, filePath: string): FileResult {
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

  const result = PluginManifestSchema.safeParse(parsed);
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

    // Warnings
    if (!m.icon) {
      issues.push({ level: 'warning', message: 'Missing icon URL', path: 'icon' });
    }
    if (!m.homepage) {
      issues.push({ level: 'warning', message: 'Missing homepage URL', path: 'homepage' });
    }
    if (!m.repository) {
      issues.push({ level: 'warning', message: 'Missing repository URL', path: 'repository' });
    }
    if (m.distribution === 'http' && !m.capabilities?.includes('http-fetch')) {
      issues.push({
        level: 'warning',
        message: 'HTTP plugin does not declare "http-fetch" capability',
        path: 'capabilities',
      });
    }

    const maxBytes = 64 * 1024;
    if (new TextEncoder().encode(content).length > maxBytes) {
      issues.push({ level: 'error', message: 'Manifest exceeds 64KB size limit', path: '' });
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
    results.push(validatePluginManifest(content, file.path));
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