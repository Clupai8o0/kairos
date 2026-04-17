import type { ValidationSummary } from './types.js';

export function formatHuman(summary: ValidationSummary): string {
  const lines: string[] = [];

  for (const file of summary.files) {
    const icon = file.ok ? '✓' : '✗';
    lines.push(`${icon} ${file.path}`);

    for (const issue of file.issues) {
      const lvl = issue.level === 'error' ? '✗' : issue.level === 'warning' ? '⚠' : 'ℹ';
      lines.push(`  ${lvl} [${issue.code}] ${issue.message}${issue.path ? ` (at ${issue.path})` : ''}`);
    }

    if (file.issues.length === 0 && file.ok) {
      lines.push('  All checks passed');
    }
    lines.push('');
  }

  const { total, errors, warnings } = summary.summary;
  lines.push(`${total} file(s) checked, ${errors} error(s), ${warnings} warning(s)`);
  return lines.join('\n');
}

export function formatJson(summary: ValidationSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function exitCodeFor(summary: ValidationSummary, strict: boolean): number {
  if (summary.summary.errors > 0) return 2;
  if (strict && summary.summary.warnings > 0) return 1;
  return 0;
}