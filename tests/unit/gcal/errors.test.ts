import { describe, it, expect } from 'vitest';
import { mapGoogleError, GCalAuthError, GCalNotFoundError, GCalRateLimitError, GCalError } from '@/lib/gcal/errors';

describe('mapGoogleError', () => {
  it('maps 401 to GCalAuthError', () => {
    expect(mapGoogleError({ code: 401, message: 'Unauthorized' })).toBeInstanceOf(GCalAuthError);
  });
  it('maps 403 to GCalAuthError', () => {
    expect(mapGoogleError({ code: 403, message: 'Forbidden' })).toBeInstanceOf(GCalAuthError);
  });
  it('maps 404 to GCalNotFoundError', () => {
    expect(mapGoogleError({ code: 404, message: 'Not found' })).toBeInstanceOf(GCalNotFoundError);
  });
  it('maps 429 to GCalRateLimitError', () => {
    expect(mapGoogleError({ code: 429, message: 'Rate limited' })).toBeInstanceOf(GCalRateLimitError);
  });
  it('maps unknown to GCalError', () => {
    expect(mapGoogleError({ code: 500, message: 'oops' })).toBeInstanceOf(GCalError);
  });
  it('preserves message', () => {
    const err = mapGoogleError({ code: 404, message: 'Event gone' });
    expect(err.message).toBe('Event gone');
  });
});
