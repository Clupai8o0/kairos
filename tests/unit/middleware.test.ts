import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock lib/beta-gate so we control verifyBetaCookie output
vi.mock('@/lib/beta-gate', () => ({
  COOKIE_NAME: 'kairos_beta',
  verifyBetaCookie: vi.fn(),
}));

async function makeRequest(pathname: string, cookieValue?: string): Promise<NextRequest> {
  const url = `http://localhost:3000${pathname}`;
  const headers: Record<string, string> = {};
  if (cookieValue) headers['cookie'] = `kairos_beta=${cookieValue}`;
  return new NextRequest(url, { headers });
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows / through without a cookie', async () => {
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/');
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(308);
  });

  it('allows /beta-gate through without a cookie', async () => {
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/beta-gate');
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(308);
  });

  it('allows /api/beta-gate through without a cookie', async () => {
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/api/beta-gate');
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(308);
  });

  it('redirects /app/dashboard without cookie to /beta-gate?next=/app/dashboard', async () => {
    const { verifyBetaCookie } = await import('@/lib/beta-gate');
    vi.mocked(verifyBetaCookie).mockResolvedValue(false);
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/app/dashboard');
    const res = await middleware(req);
    expect([307, 308]).toContain(res.status);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/beta-gate');
    expect(location).toContain('next=%2Fapp%2Fdashboard');
  });

  it('allows /app/dashboard through with a valid cookie', async () => {
    const { verifyBetaCookie } = await import('@/lib/beta-gate');
    vi.mocked(verifyBetaCookie).mockResolvedValue(true);
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/app/dashboard', 'valid-token');
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(308);
  });
});
