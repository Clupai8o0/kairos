import type { PluginManifest } from './manifest-types';

const MAX_MANIFEST_BYTES = 64 * 1024; // 64KB

const BUILTIN_PLUGIN_IDS = new Set(['text-to-tasks']);

// Private IP ranges for DNS rebinding protection
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export interface SafetyCheckResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

export function runPluginSafetyChecks(
  manifest: PluginManifest,
  rawJson: string,
): SafetyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Size limit
  if (new TextEncoder().encode(rawJson).length > MAX_MANIFEST_BYTES) {
    errors.push('Manifest exceeds 64KB size limit.');
  }

  // 2. ID uniqueness — must not collide with built-in plugin IDs
  if (BUILTIN_PLUGIN_IDS.has(manifest.id)) {
    errors.push(`Plugin ID "${manifest.id}" conflicts with a built-in plugin.`);
  }

  // 3. URL allowlist for HTTP plugins
  if (manifest.distribution === 'http' && manifest.endpoint) {
    try {
      const url = new URL(manifest.endpoint);
      if (url.protocol !== 'https:') {
        errors.push('HTTP plugin endpoint must use HTTPS.');
      }
    } catch {
      errors.push(`Invalid endpoint URL: ${manifest.endpoint}`);
    }
  }

  // 4. Handler declaration
  if (!manifest.handlesInputTypes || manifest.handlesInputTypes.length === 0) {
    errors.push('Plugin must handle at least one input type.');
  }

  // 5. ID format
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) {
    errors.push('Plugin ID must match /^[a-z0-9][a-z0-9-]*$/.');
  }

  // 6. Version format
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push('Version must be valid semver (e.g., 1.0.0).');
  }

  // 7. Distribution consistency
  if (manifest.distribution === 'http' && !manifest.endpoint) {
    errors.push('HTTP plugins must provide an endpoint URL.');
  }
  if (manifest.distribution === 'bundled' && !manifest.npmPackage) {
    errors.push('Bundled plugins must provide an npmPackage name.');
  }

  // 8. Capabilities declared for resource access
  if (manifest.endpoint && !manifest.capabilities?.includes('http-fetch')) {
    warnings.push('HTTP plugin does not declare "http-fetch" capability.');
  }

  return { ok: errors.length === 0, warnings, errors };
}

/**
 * Check if a resolved IP is in a private range (DNS rebinding protection).
 * Used at install time and on each HTTP call.
 */
export function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(ip));
}