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
  const e = error as { code?: number; message?: string; errors?: { reason?: string }[] };
  const msg = e.message ?? 'Google Calendar error';
  // Google returns 403 for both auth errors AND quota/rate-limit errors.
  // Disambiguate via the errors[0].reason field.
  if (e.code === 403) {
    const reason = e.errors?.[0]?.reason ?? '';
    if (reason === 'rateLimitExceeded' || reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
      return new GCalRateLimitError(msg);
    }
    return new GCalAuthError(msg);
  }
  if (e.code === 401) return new GCalAuthError(msg);
  if (e.code === 404) return new GCalNotFoundError(msg);
  if (e.code === 429) return new GCalRateLimitError(msg);
  return new GCalError(msg);
}
