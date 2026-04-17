export type ValidationLevel = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  path?: string;
}

export interface FileResult {
  path: string;
  ok: boolean;
  issues: ValidationIssue[];
  timing: { durationMs: number };
}

export interface ValidationSummary {
  files: FileResult[];
  summary: { total: number; errors: number; warnings: number };
}