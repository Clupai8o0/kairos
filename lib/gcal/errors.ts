// lib/gcal/errors.ts

export class GCalError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'GCalError';
  }
}

export class GCalAuthError extends GCalError {
  constructor(message: string) { super(message, 'AUTH_ERROR'); this.name = 'GCalAuthError'; }
}

export class GCalNotFoundError extends GCalError {
  constructor(message: string) { super(message, 'NOT_FOUND'); this.name = 'GCalNotFoundError'; }
}

export class GCalRateLimitError extends GCalError {
  constructor(message: string) { super(message, 'RATE_LIMIT'); this.name = 'GCalRateLimitError'; }
}

export function mapGoogleError(error: unknown): GCalError {
  const e = error as { code?: number; message?: string };
  const msg = e.message ?? 'Google Calendar error';
  if (e.code === 401 || e.code === 403) return new GCalAuthError(msg);
  if (e.code === 404) return new GCalNotFoundError(msg);
  if (e.code === 429) return new GCalRateLimitError(msg);
  return new GCalError(msg);
}
