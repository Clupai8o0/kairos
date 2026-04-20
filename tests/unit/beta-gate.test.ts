import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must set env before importing the module
beforeEach(() => {
  process.env.BETA_SECRET = 'test-secret-at-least-32-chars-long!!';
});

afterEach(() => {
  delete process.env.BETA_SECRET;
  vi.resetModules();
});

describe('beta-gate cookie signing', () => {
  it('signBetaCookie returns a non-empty string', async () => {
    const { signBetaCookie } = await import('@/lib/beta-gate');
    const token = await signBetaCookie();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('verifyBetaCookie returns true for a freshly signed cookie', async () => {
    const { signBetaCookie, verifyBetaCookie } = await import('@/lib/beta-gate');
    const token = await signBetaCookie();
    expect(await verifyBetaCookie(token)).toBe(true);
  });

  it('verifyBetaCookie returns false for a tampered token', async () => {
    const { signBetaCookie, verifyBetaCookie } = await import('@/lib/beta-gate');
    const token = await signBetaCookie();
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifyBetaCookie(tampered)).toBe(false);
  });

  it('verifyBetaCookie returns false for a token signed with wrong secret', async () => {
    process.env.BETA_SECRET = 'secret-A-at-least-32-chars-long!!!';
    const { signBetaCookie } = await import('@/lib/beta-gate');
    const token = await signBetaCookie();

    vi.resetModules();
    process.env.BETA_SECRET = 'secret-B-at-least-32-chars-long!!!';
    const { verifyBetaCookie } = await import('@/lib/beta-gate');
    expect(await verifyBetaCookie(token)).toBe(false);
  });

  it('verifyBetaCookie returns false for a completely invalid string', async () => {
    const { verifyBetaCookie } = await import('@/lib/beta-gate');
    expect(await verifyBetaCookie('not.a.jwt')).toBe(false);
    expect(await verifyBetaCookie('')).toBe(false);
  });
});
