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
