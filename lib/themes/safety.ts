import { BUILT_IN_PACKS } from '@/app/styles/packs/manifest';
import type { ThemeManifest } from './types';

const MAX_MANIFEST_BYTES = 64 * 1024; // 64KB

const FONT_ALLOWLIST = [
  'fonts.googleapis.com',
  'rsms.me',
  'cdn.jsdelivr.net',
];

export interface SafetyCheckResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

export function runSafetyChecks(
  manifest: ThemeManifest,
  rawJson: string,
  compiledCss: string,
): SafetyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Size limit
  if (new TextEncoder().encode(rawJson).length > MAX_MANIFEST_BYTES) {
    errors.push(`Manifest exceeds 64KB size limit.`);
  }

  // 2. ID uniqueness — must not collide with built-in pack IDs
  const builtinIds = new Set(BUILT_IN_PACKS.map((p) => p.id));
  if (builtinIds.has(manifest.id)) {
    errors.push(`Theme ID "${manifest.id}" conflicts with a built-in pack.`);
  }

  // 3. Font allowlist
  for (const url of manifest.fontImports ?? []) {
    try {
      const { hostname } = new URL(url);
      if (!FONT_ALLOWLIST.some((allowed) => hostname === allowed || hostname.endsWith('.' + allowed))) {
        errors.push(`Font import URL not on the allowlist: ${url}`);
      }
    } catch {
      errors.push(`Invalid font import URL: ${url}`);
    }
  }

  // 4. CSS injection scan on compiled output
  const injectionPatterns: [RegExp, string][] = [
    [/expression\s*\(/i, 'CSS expression() is not allowed'],
    [/behavior\s*:/i, 'CSS behavior: is not allowed'],
    [/-moz-binding\s*:/i, 'CSS -moz-binding: is not allowed'],
    [/javascript:/i, 'javascript: URI is not allowed'],
  ];
  for (const [pattern, msg] of injectionPatterns) {
    if (pattern.test(compiledCss)) {
      errors.push(msg);
    }
  }

  // 5. Scan @import in compiled CSS for allowlist violations
  const importMatches = compiledCss.matchAll(/@import\s+url\(['"]?([^'")\s]+)['"]?\)/gi);
  for (const match of importMatches) {
    const importUrl = match[1];
    if (!importUrl) continue;
    try {
      const { hostname } = new URL(importUrl);
      if (!FONT_ALLOWLIST.some((a) => hostname === a || hostname.endsWith('.' + a))) {
        errors.push(`@import URL not on the font allowlist: ${importUrl}`);
      }
    } catch {
      errors.push(`Invalid @import URL in compiled CSS: ${importUrl}`);
    }
  }

  // 6. url() scan
  const urlMatches = compiledCss.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/gi);
  for (const match of urlMatches) {
    const u = match[1];
    if (!u) continue;
    if (u.startsWith('data:')) continue; // data URIs ok for small inline assets
    try {
      const { hostname } = new URL(u);
      if (!FONT_ALLOWLIST.some((a) => hostname === a || hostname.endsWith('.' + a))) {
        warnings.push(`url() reference to external host: ${u}`);
      }
    } catch {
      // relative URLs are fine
    }
  }

  return { ok: errors.length === 0, warnings, errors };
}
