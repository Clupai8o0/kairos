# Beta Gate + Resend Email Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared-password beta gate protecting all non-public routes, and wire Resend transactional email into Better Auth — both via thin abstraction layers that match the existing `lib/llm/` pattern.

**Architecture:** The beta gate lives in `lib/beta-gate/` (JWT signing/verification via `jose`) and a `middleware.ts` at the repo root that reads one cookie; the email layer lives in `lib/email/` (the only file that imports `resend`) and is called from Better Auth's `emailVerification` hook. Rate limiting for the gate uses a `beta_gate_attempts` Postgres table since serverless instances don't share memory.

**Tech Stack:** Next.js 16 middleware (Node.js runtime), `jose` for HMAC-SHA256 JWTs, `resend` + `@react-email/components` + `@react-email/render` for email, Drizzle ORM, Vitest.

---

## File map

### New files
| Path | Responsibility |
|---|---|
| `lib/beta-gate/index.ts` | `signBetaCookie`, `verifyBetaCookie`, `COOKIE_NAME` |
| `middleware.ts` | Cookie check, redirect to `/beta-gate`, public-path list |
| `lib/db/schema/beta-gate.ts` | `betaGateAttempts` table definition |
| `drizzle/0009_beta_gate_attempts.sql` | DB migration |
| `app/(marketing)/beta-gate/page.tsx` | Server Component wrapper (reads `next` param) |
| `app/(marketing)/beta-gate/BetaGateForm.tsx` | Client Component form |
| `app/api/beta-gate/route.ts` | POST handler — rate limit, timing-safe compare, set cookie |
| `lib/email/client.ts` | Singleton `resend` client (only file that imports `resend`) |
| `lib/email/send.ts` | `sendEmail()` — the single public email function |
| `lib/email/templates/VerificationEmail.tsx` | React email template for email verification |
| `eslint-rules/no-resend-imports.js` | Bans `resend` imports outside `lib/email/` |
| `references/email-setup.md` | Resend DNS setup documentation |
| `tests/unit/beta-gate.test.ts` | Unit tests: sign/verify/tamper/expiry |
| `tests/unit/middleware.test.ts` | Middleware: public paths, missing cookie, valid cookie |
| `tests/integration/beta-gate-api.test.ts` | API: correct/wrong password, rate limit, bad next |
| `tests/unit/email/send.test.ts` | Email send: success, API failure, throws |
| `tests/unit/email/verification-email.test.tsx` | Snapshot: renders without crashing |

### Modified files
| Path | Change |
|---|---|
| `lib/db/schema/index.ts` | Add `export * from './beta-gate'` |
| `lib/auth/index.ts` | Add `emailVerification` config block |
| `eslint.config.mjs` | Register `no-resend-imports` rule |
| `next.config.ts` | Add `experimental: { nodeMiddleware: true }` |
| `.env.example` | Add `BETA_PASSWORD`, `BETA_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` |

---

## Task 1: Install dependencies

**Files:** `package.json` (modified by pnpm)

- [ ] **Step 1: Install `jose`**

```bash
cd /Users/clupa/Documents/projects/kairos/kairos
pnpm add jose
```

Expected: `jose` appears in `package.json` dependencies.

- [ ] **Step 2: Install email packages**

```bash
pnpm add resend @react-email/components @react-email/render
```

Expected: three new entries in `package.json` dependencies.

- [ ] **Step 3: Verify no peer-dep warnings**

```bash
pnpm install
```

Expected: clean install, no unmet peer deps.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add jose, resend, react-email"
```

---

## Task 2: Beta gate DB schema + migration

**Files:**
- Create: `lib/db/schema/beta-gate.ts`
- Modify: `lib/db/schema/index.ts`
- Create: `drizzle/0009_beta_gate_attempts.sql`

- [ ] **Step 1: Create schema file**

```ts
// lib/db/schema/beta-gate.ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { newId } from '@/lib/utils/id';

export const betaGateAttempts = pgTable(
  'beta_gate_attempts',
  {
    id: text('id').primaryKey().$defaultFn(() => newId()),
    ip: text('ip').notNull(),
    attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
  },
  (t) => [index('beta_gate_attempts_ip_at_idx').on(t.ip, t.attemptedAt)],
);
```

- [ ] **Step 2: Export from schema index**

In `lib/db/schema/index.ts`, append:

```ts
export * from './beta-gate';
```

- [ ] **Step 3: Create migration SQL**

```sql
-- drizzle/0009_beta_gate_attempts.sql
CREATE TABLE IF NOT EXISTS "beta_gate_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "ip" text NOT NULL,
  "attempted_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "beta_gate_attempts_ip_at_idx"
  ON "beta_gate_attempts" ("ip", "attempted_at");
```

> **Note:** Drizzle-kit will auto-generate this file if you run `pnpm drizzle-kit generate` — use that output and verify it matches the above. If the auto-generated name differs (drizzle-kit picks random adjective names), rename to `0009_beta_gate_attempts.sql` for clarity.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema/beta-gate.ts lib/db/schema/index.ts drizzle/0009_beta_gate_attempts.sql
git commit -m "feat(db): add beta_gate_attempts table"
```

---

## Task 3: `lib/beta-gate/index.ts` + unit tests

**Files:**
- Create: `lib/beta-gate/index.ts`
- Create: `tests/unit/beta-gate.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/beta-gate.test.ts
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
    // Sign with one secret, verify with another
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/unit/beta-gate.test.ts
```

Expected: all 5 tests fail with module-not-found or similar.

- [ ] **Step 3: Implement `lib/beta-gate/index.ts`**

```ts
// lib/beta-gate/index.ts
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'kairos_beta';
const EXPIRY_SECONDS = 30 * 24 * 60 * 60;

function getSecret(): Uint8Array {
  const s = process.env.BETA_SECRET;
  if (!s) throw new Error('BETA_SECRET env var is required');
  return new TextEncoder().encode(s);
}

export async function signBetaCookie(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyBetaCookie(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run tests/unit/beta-gate.test.ts
```

Expected: 5/5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/beta-gate/index.ts tests/unit/beta-gate.test.ts
git commit -m "feat(beta-gate): JWT cookie signing and verification"
```

---

## Task 4: `middleware.ts` + unit tests

**Files:**
- Create: `middleware.ts` (repo root)
- Modify: `next.config.ts`
- Create: `tests/unit/middleware.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/middleware.test.ts
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
  });

  it('allows /beta-gate through without a cookie', async () => {
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/beta-gate');
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it('allows /api/beta-gate through without a cookie', async () => {
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/api/beta-gate');
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it('redirects /app/dashboard without cookie to /beta-gate?next=/app/dashboard', async () => {
    const { verifyBetaCookie } = await import('@/lib/beta-gate');
    vi.mocked(verifyBetaCookie).mockResolvedValue(false);
    const { middleware } = await import('@/middleware');
    const req = await makeRequest('/app/dashboard');
    const res = await middleware(req);
    expect(res.status).toBe(307);
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
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run tests/unit/middleware.test.ts
```

Expected: fail — no middleware module yet.

- [ ] **Step 3: Create `middleware.ts`**

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyBetaCookie, COOKIE_NAME } from '@/lib/beta-gate';

const PUBLIC_PREFIXES = ['/beta-gate', '/api/beta-gate', '/docs', '/_next'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && (await verifyBetaCookie(token))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/beta-gate';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)',
  ],
};
```

- [ ] **Step 4: Update `next.config.ts` for Node.js middleware**

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    nodeMiddleware: true,
  },
};

export default nextConfig;
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm vitest run tests/unit/middleware.test.ts
```

Expected: 5/5 passing.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts next.config.ts tests/unit/middleware.test.ts
git commit -m "feat(beta-gate): middleware cookie check and public-path routing"
```

---

## Task 5: `app/api/beta-gate/route.ts` + integration tests

**Files:**
- Create: `app/api/beta-gate/route.ts`
- Create: `tests/integration/beta-gate-api.test.ts`

- [ ] **Step 1: Write failing integration tests**

```ts
// tests/integration/beta-gate-api.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_IP = '127.0.0.1';

// Mock DB so tests don't need a real database
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  betaGateAttempts: { ip: 'ip', attemptedAt: 'attempted_at' },
}));

// Mock drizzle helpers so no real SQL runs
vi.mock('drizzle-orm', async (importOriginal) => {
  const orig = await importOriginal<typeof import('drizzle-orm')>();
  return { ...orig, count: vi.fn(() => 'count'), and: vi.fn(), gte: vi.fn(), eq: vi.fn() };
});

function jsonRequest(body: unknown, ip = MOCK_IP) {
  return new NextRequest('http://localhost:3000/api/beta-gate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/beta-gate', () => {
  beforeEach(() => {
    process.env.BETA_PASSWORD = 'correct-password';
    process.env.BETA_SECRET = 'test-secret-at-least-32-chars-long!!';
    vi.clearAllMocks();
  });

  it('returns 200 and sets cookie on correct password', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('kairos_beta=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('returns 401 on wrong password', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'wrong-password' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid password');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('returns 400 on malformed body', async () => {
    const { POST } = await import('@/app/api/beta-gate/route');
    const req = new NextRequest('http://localhost:3000/api/beta-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 10 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password' }));
    expect(res.status).toBe(429);
  });

  it('sanitises a dangerous next param — absolute URL falls back to /login', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password', next: 'http://evil.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBe('/login');
  });

  it('sanitises a protocol-relative next param — falls back to /login', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password', next: '//evil.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBe('/login');
  });

  it('allows a valid relative next param through', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select().from().where).mockResolvedValue([{ count: 0 }]);

    const { POST } = await import('@/app/api/beta-gate/route');
    const res = await POST(jsonRequest({ password: 'correct-password', next: '/app/dashboard' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBe('/app/dashboard');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run tests/integration/beta-gate-api.test.ts
```

Expected: all fail — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/beta-gate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { betaGateAttempts } from '@/lib/db/schema';
import { signBetaCookie, COOKIE_NAME } from '@/lib/beta-gate';

const RATE_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

const schema = z.object({
  password: z.string(),
  next: z.string().optional(),
});

function sanitizeNext(next?: string): string {
  if (!next) return '/login';
  if (!next.startsWith('/') || next.startsWith('//')) return '/login';
  return next;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const [row] = await db
    .select({ count: count() })
    .from(betaGateAttempts)
    .where(and(eq(betaGateAttempts.ip, ip), gte(betaGateAttempts.attemptedAt, windowStart)));

  if ((row?.count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  await db.insert(betaGateAttempts).values({ ip });

  const expected = process.env.BETA_PASSWORD ?? '';
  const actual = parsed.data.password;
  const match =
    expected.length > 0 &&
    expected.length === actual.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected));

  if (!match) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });

  const token = await signBetaCookie();
  const next = sanitizeNext(parsed.data.next);

  const res = NextResponse.json({ ok: true, next });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run tests/integration/beta-gate-api.test.ts
```

Expected: 7/7 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/beta-gate/route.ts tests/integration/beta-gate-api.test.ts
git commit -m "feat(beta-gate): POST /api/beta-gate with rate limiting and cookie"
```

---

## Task 6: Beta gate page UI

**Files:**
- Create: `app/(marketing)/beta-gate/page.tsx`
- Create: `app/(marketing)/beta-gate/BetaGateForm.tsx`

No tests for the UI components — the logic is in the API route (already tested).

- [ ] **Step 1: Create the Client Component form**

```tsx
// app/(marketing)/beta-gate/BetaGateForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BetaGateForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;

    try {
      const res = await fetch('/api/beta-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Access denied.');
        return;
      }
      router.replace(data.next ?? '/login');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: '100%',
        maxWidth: '360px',
        padding: '32px',
        background: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
      }}
    >
      <h1
        style={{
          color: 'var(--color-fg-default)',
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '6px',
          letterSpacing: '-0.01em',
        }}
      >
        Access required
      </h1>
      <p
        style={{
          color: 'var(--color-fg-muted)',
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: '1.5',
        }}
      >
        Enter the access password to continue.
      </p>

      <label
        htmlFor="password"
        style={{
          display: 'block',
          color: 'var(--color-fg-subtle)',
          fontSize: '12px',
          fontWeight: '500',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          color: 'var(--color-fg-default)',
          fontSize: '14px',
          marginBottom: '16px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {error && (
        <p
          style={{
            color: 'var(--color-danger)',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '9px 16px',
          background: 'var(--color-accent)',
          border: 'none',
          borderRadius: '6px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Verifying…' : 'Continue'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the Server Component wrapper**

```tsx
// app/(marketing)/beta-gate/page.tsx
import type { Metadata } from 'next';
import { BetaGateForm } from './BetaGateForm';

export const metadata: Metadata = { title: 'Access required' };

export default async function BetaGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <BetaGateForm next={next} />
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm tsc --noEmit
```

Expected: no errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/beta-gate/
git commit -m "feat(beta-gate): gate page and form UI"
```

---

## Task 7: `lib/email/client.ts` + `lib/email/send.ts` + unit tests

**Files:**
- Create: `lib/email/client.ts`
- Create: `lib/email/send.ts`
- Create: `tests/unit/email/send.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/email/send.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock the resend client so no real API calls are made
vi.mock('@/lib/email/client', () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
}));

// Mock @react-email/render so templates don't need to be real
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockImplementation(async (_el, opts) =>
    opts?.plainText ? 'plain text body' : '<html>email body</html>',
  ),
}));

describe('sendEmail', () => {
  beforeEach(() => {
    process.env.EMAIL_FROM = 'Kairos <noreply@mail.clupai.com>';
    vi.clearAllMocks();
  });

  it('calls resend with rendered HTML and text and returns ok:true', async () => {
    const { resend } = await import('@/lib/email/client');
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: { id: 'msg-123' },
      error: null,
    });

    const { sendEmail } = await import('@/lib/email/send');
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: React.createElement('div', null, 'hello'),
    });

    expect(result).toEqual({ ok: true, id: 'msg-123' });
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test',
        html: '<html>email body</html>',
        text: 'plain text body',
        from: 'Kairos <noreply@mail.clupai.com>',
      }),
    );
  });

  it('returns ok:false without throwing when Resend returns an error', async () => {
    const { resend } = await import('@/lib/email/client');
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Invalid to address' },
    });

    const { sendEmail } = await import('@/lib/email/send');
    const result = await sendEmail({
      to: 'bad',
      subject: 'Test',
      react: React.createElement('div'),
    });

    expect(result).toEqual({ ok: false, error: 'Invalid to address' });
  });

  it('returns ok:false without throwing when resend.emails.send throws', async () => {
    const { resend } = await import('@/lib/email/client');
    vi.mocked(resend.emails.send).mockRejectedValue(new Error('Network error'));

    const { sendEmail } = await import('@/lib/email/send');
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: React.createElement('div'),
    });

    expect(result).toEqual({ ok: false, error: 'Network error' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run tests/unit/email/send.test.ts
```

Expected: all fail — modules don't exist yet.

- [ ] **Step 3: Create `lib/email/client.ts`**

```ts
// lib/email/client.ts — ONLY file that imports resend
import { Resend } from 'resend';

function createClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key && process.env.KAIROS_MODE !== 'self-hosted-no-email') {
    throw new Error(
      'RESEND_API_KEY is required. Set KAIROS_MODE=self-hosted-no-email to skip email.',
    );
  }
  return new Resend(key ?? 'missing');
}

export const resend = createClient();
```

- [ ] **Step 4: Create `lib/email/send.ts`**

```ts
// lib/email/send.ts
import type { ReactElement } from 'react';
import { render } from '@react-email/render';
import { resend } from './client';

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
}

type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const from = process.env.EMAIL_FROM ?? 'Kairos <noreply@mail.clupai.com>';
  const [html, text] = await Promise.all([
    render(opts.react),
    render(opts.react, { plainText: true }),
  ]);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html,
      text,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });

    if (error || !data) {
      console.error('[email] send failed:', error);
      return { ok: false, error: error?.message ?? 'Unknown error' };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] send threw:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm vitest run tests/unit/email/send.test.ts
```

Expected: 3/3 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/email/client.ts lib/email/send.ts tests/unit/email/send.test.ts
git commit -m "feat(email): resend client and sendEmail abstraction"
```

---

## Task 8: `VerificationEmail.tsx` template + snapshot test

**Files:**
- Create: `lib/email/templates/VerificationEmail.tsx`
- Create: `tests/unit/email/verification-email.test.tsx`

- [ ] **Step 1: Write snapshot test**

```tsx
// tests/unit/email/verification-email.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { VerificationEmail } from '@/lib/email/templates/VerificationEmail';

describe('VerificationEmail template', () => {
  it('renders to HTML without throwing', async () => {
    const html = await render(
      VerificationEmail({
        userName: 'Sam',
        verificationUrl: 'https://kairos.app/verify?token=abc123',
      }),
    );
    expect(html).toContain('Sam');
    expect(html).toContain('https://kairos.app/verify?token=abc123');
  });

  it('matches snapshot', async () => {
    const html = await render(
      VerificationEmail({
        userName: 'Sam',
        verificationUrl: 'https://kairos.app/verify?token=abc123',
      }),
    );
    expect(html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run tests/unit/email/verification-email.test.tsx
```

Expected: fail — template doesn't exist.

- [ ] **Step 3: Create the template**

```tsx
// lib/email/templates/VerificationEmail.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface Props {
  userName: string;
  verificationUrl: string;
}

export function VerificationEmail({ userName, verificationUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Verify your Kairos email address</Preview>
      <Body style={{ backgroundColor: '#0d0d0f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '48px auto', padding: '32px' }}>
          <Heading
            style={{
              color: '#f5f5f7',
              fontSize: '22px',
              fontWeight: '600',
              margin: '0 0 12px',
              letterSpacing: '-0.01em',
            }}
          >
            Verify your email
          </Heading>
          <Text style={{ color: '#a0a0ab', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px' }}>
            Hi {userName} — click the button below to verify your email address and complete your
            account setup.
          </Text>
          <Section style={{ margin: '0 0 24px' }}>
            <Button
              href={verificationUrl}
              style={{
                backgroundColor: '#6366f1',
                color: '#ffffff',
                padding: '11px 22px',
                borderRadius: '7px',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Verify email
            </Button>
          </Section>
          <Text style={{ color: '#52525b', fontSize: '13px', lineHeight: '1.5', margin: '0' }}>
            If you did not sign up for Kairos, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4: Run tests — expect pass and snapshot written**

```bash
pnpm vitest run tests/unit/email/verification-email.test.tsx
```

Expected: 2/2 passing. A `__snapshots__/verification-email.test.tsx.snap` file is created.

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/VerificationEmail.tsx tests/unit/email/verification-email.test.tsx tests/unit/email/__snapshots__/
git commit -m "feat(email): VerificationEmail template with snapshot test"
```

---

## Task 9: Wire Better Auth email verification

**Files:**
- Modify: `lib/auth/index.ts`

- [ ] **Step 1: Update `lib/auth/index.ts`**

Add the `emailVerification` block. The full file becomes:

```ts
// lib/auth/index.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db/client';
import { sendEmail } from '@/lib/email/send';
import { VerificationEmail } from '@/lib/email/templates/VerificationEmail';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    camelCase: true,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ['https://www.googleapis.com/auth/calendar'],
      accessType: 'offline',
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verify your Kairos email',
        react: VerificationEmail({
          userName: user.name ?? user.email,
          verificationUrl: url,
        }),
      });
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Auth = typeof auth;
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/index.ts
git commit -m "feat(email): wire sendEmail into Better Auth emailVerification hook"
```

---

## Task 10: ESLint rule banning `resend` imports outside `lib/email/`

**Files:**
- Create: `eslint-rules/no-resend-imports.js`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Create the rule**

```js
// eslint-rules/no-resend-imports.js
// Bans direct resend imports outside lib/email/ (mirrors ADR-R10 for email provider).
const ALLOWED_PATH_FRAGMENTS = ['/lib/email/'];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow resend imports outside lib/email/.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWED_PATH_FRAGMENTS.some((f) => filename.includes(f))) return {};
    return {
      ImportDeclaration(node) {
        const source = /** @type {string} */ (node.source.value);
        if (source === 'resend' || source.startsWith('resend/')) {
          context.report({
            node,
            message:
              "Direct 'resend' imports are only allowed inside lib/email/ (ADR-R10 analogue). Use lib/email/send.ts instead.",
          });
        }
      },
    };
  },
};
```

- [ ] **Step 2: Register the rule in `eslint.config.mjs`**

```js
// eslint.config.mjs
import { createRequire } from 'module';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const require = createRequire(import.meta.url);

const noProjectEntity = require('./eslint-rules/no-project-entity.js');
const noLlmProviderImports = require('./eslint-rules/no-llm-provider-imports.js');
const noRawColors = require('./eslint-rules/no-raw-colors.js');
const noResendImports = require('./eslint-rules/no-resend-imports.js');

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    plugins: {
      kairos: {
        rules: {
          'no-project-entity': noProjectEntity,
          'no-llm-provider-imports': noLlmProviderImports,
          'no-raw-colors': noRawColors,
          'no-resend-imports': noResendImports,
        },
      },
    },
    rules: {
      'kairos/no-project-entity': 'error',
      'kairos/no-llm-provider-imports': 'error',
      'kairos/no-raw-colors': 'error',
      'kairos/no-resend-imports': 'error',
    },
  },
]);

export default eslintConfig;
```

- [ ] **Step 3: Verify ESLint passes**

```bash
pnpm eslint lib/ app/ --ext .ts,.tsx
```

Expected: 0 errors, 0 new warnings.

- [ ] **Step 4: Commit**

```bash
git add eslint-rules/no-resend-imports.js eslint.config.mjs
git commit -m "lint: add no-resend-imports rule (ADR-R10 analogue for email)"
```

---

## Task 11: `.env.example` updates + `references/email-setup.md`

**Files:**
- Modify: `.env.example`
- Create: `references/email-setup.md`

- [ ] **Step 1: Add env vars to `.env.example`**

Append to the existing file:

```bash
# --- Beta gate ---
# A shared password that lets users past the beta gate.
BETA_PASSWORD="change-me-to-a-real-password"
# Generate with: openssl rand -base64 32
BETA_SECRET="generate-with-openssl-rand-base64-32"

# --- Email (Resend) ---
# Get from resend.com → API Keys
RESEND_API_KEY="re_xxx"
# Must match a Resend-verified domain/subdomain
EMAIL_FROM="Kairos <noreply@mail.clupai.com>"
# Set to 'self-hosted-no-email' to skip email entirely (self-hosters who don't need it)
# KAIROS_MODE=self-hosted-no-email
```

- [ ] **Step 2: Create `references/email-setup.md`**

```markdown
# Email Setup — Resend + Cloudflare DNS

Kairos sends transactional email (account verification, future notifications) via [Resend](https://resend.com).

## 1. Create a Resend account

Sign up at resend.com. The free tier allows 3,000 emails/month and 100/day — more than enough for beta.

## 2. Verify a sending domain

Resend requires you to verify a domain before you can send from it. We recommend using a subdomain (`mail.clupai.com`) rather than the apex domain to isolate deliverability reputation.

In the Resend dashboard → Domains → Add Domain → enter `mail.clupai.com`.

## 3. Add DNS records in Cloudflare

Resend will give you several DNS records (DKIM TXT records, SPF TXT record, possibly a DMARC record). Add each one in Cloudflare DNS:

- Set the **proxy status to DNS-only (grey cloud)** for all of these records. These are verification/routing records — proxying them through Cloudflare breaks DKIM validation.
- The DKIM records are TXT records with long values like `v=DKIM1; k=rsa; p=...`
- The SPF record is a TXT record on `mail.clupai.com` containing `v=spf1 include:amazonses.com ~all` (Resend sends via Amazon SES)

Wait for Resend to show the domain as "Verified" — usually under 5 minutes once DNS propagates.

## 4. Create an API key

In the Resend dashboard → API Keys → Create API key. Give it a descriptive name (`kairos-prod`) and "Sending access" permission. Copy the key — it's only shown once.

## 5. Set environment variables

```env
RESEND_API_KEY="re_your_actual_key"
EMAIL_FROM="Kairos <noreply@mail.clupai.com>"
```

The `EMAIL_FROM` address must use the verified domain (`mail.clupai.com`).

## 6. Self-hosted: opt out of email

If you're self-hosting and don't need email, add:

```env
KAIROS_MODE=self-hosted-no-email
```

This bypasses the `RESEND_API_KEY` check at startup. Email sends will still be attempted and will fail gracefully (no throw) — `sendEmail` always returns `{ ok: false }` in this case.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example references/email-setup.md
git commit -m "docs: env.example + Resend DNS setup guide"
```

---

## Task 12: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Append session log**

Append to the top of the "Current State" section and at the end of the file:

```markdown
- [x] Beta gate: `lib/beta-gate/index.ts` (HMAC-SHA256 JWT via jose), `middleware.ts` (Node.js runtime, public-path list), `app/(marketing)/beta-gate/` (server + client form), `app/api/beta-gate/route.ts` (timing-safe compare, DB-backed rate limit, cookie set)
- [x] Beta gate DB: `betaGateAttempts` table + `drizzle/0009_beta_gate_attempts.sql` migration
- [x] Resend email: `lib/email/client.ts` (singleton), `lib/email/send.ts` (`sendEmail` — never throws), `lib/email/templates/VerificationEmail.tsx` (react-email)
- [x] Better Auth wired: `emailVerification.sendVerificationEmail` calls `sendEmail` with `VerificationEmail` template
- [x] ESLint: `no-resend-imports` rule added — bans `resend` imports outside `lib/email/`
- [x] Tests: 5 unit (beta-gate), 5 unit (middleware), 7 integration (beta-gate API), 3 unit (send), 2 unit (template snapshot)
```

And add a session log entry:

```markdown
---
## Session — 2026-04-20

### Beta gate + Resend email

**Beta gate landed:** Single shared password (`BETA_PASSWORD`), verified via `crypto.timingSafeEqual`. Signed 30-day `kairos_beta` HTTP-only cookie using `jose` HMAC-SHA256 JWTs. Middleware (Node.js runtime via `experimental.nodeMiddleware`) gates all non-public paths. Rate limiting via `beta_gate_attempts` Postgres table (10 attempts per IP per 15 minutes) — chosen over in-memory because serverless instances don't share state. Public paths: `/`, `/beta-gate`, `/api/beta-gate`, `/docs/*`.

**Resend wired via `lib/email/` abstraction:** Mirrors `lib/llm/` pattern — `lib/email/client.ts` is the only file that imports `resend`. `sendEmail()` in `lib/email/send.ts` is the single public function: renders React components via `@react-email/render`, wraps Resend call, returns `{ ok, id|error }`, never throws. `VerificationEmail.tsx` template uses `@react-email/components` with a dark-background style. ESLint `no-resend-imports` rule added.

**Two new deps:** `jose` (JWT), `resend` + `@react-email/components` + `@react-email/render` (email).

### Next session
Natural follow-ups (don't do now): per-user beta allowlist to replace the shared password, async email jobs via the `jobs` table, first plugin-authored email flow.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG session log for beta gate + email"
```

---

## Final checks

- [ ] **Run full test suite**

```bash
pnpm test
```

Expected: all existing tests still pass, new tests pass.

- [ ] **Typecheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **ESLint**

```bash
pnpm eslint lib/ app/ middleware.ts eslint-rules/ --ext .ts,.tsx,.js
```

Expected: 0 errors.

- [ ] **Line count check** — no file should exceed 250 lines

```bash
wc -l middleware.ts lib/beta-gate/index.ts app/api/beta-gate/route.ts lib/email/client.ts lib/email/send.ts lib/email/templates/VerificationEmail.tsx lib/auth/index.ts
```

Expected: all well under 250.

---

## Self-review against spec

| Requirement | Covered |
|---|---|
| `/` public, no friction | ✅ `isPublic('/')` in middleware |
| `/app/*` and `/login` redirect to `/beta-gate?next=...` | ✅ middleware catch-all |
| Password form at `/beta-gate` | ✅ Task 6 |
| POST to `/api/beta-gate` | ✅ Task 5 |
| Timing-safe compare | ✅ `crypto.timingSafeEqual` in route |
| Signed HTTP-only cookie, 30-day | ✅ `signBetaCookie` + `res.cookies.set` |
| `verifyBetaCookie` never throws | ✅ try/catch returns boolean |
| `next` sanitized (no protocol-relative/absolute) | ✅ `sanitizeNext` in route |
| Rate limit 10/IP/15min | ✅ `betaGateAttempts` table query |
| Node.js runtime middleware | ✅ `experimental.nodeMiddleware` + `runtime: 'nodejs'` |
| BETA_PASSWORD + BETA_SECRET in .env.example | ✅ Task 11 |
| `lib/email/` mirrors `lib/llm/` pattern | ✅ client.ts is only resend importer |
| `sendEmail` never throws | ✅ try/catch in send.ts |
| `KAIROS_MODE=self-hosted-no-email` supported | ✅ client.ts guard |
| `VerificationEmail.tsx` template | ✅ Task 8 |
| Better Auth `emailVerification` wired | ✅ Task 9 |
| RESEND_API_KEY + EMAIL_FROM in .env.example | ✅ Task 11 |
| DNS setup documented | ✅ references/email-setup.md |
| `no-resend-imports` ESLint rule | ✅ Task 10 |
| All tests passing | ✅ final check |
| No file > 250 lines | ✅ final check |
