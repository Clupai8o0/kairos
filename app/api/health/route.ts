// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', db: 'disconnected', error: String(error) },
      { status: 503 },
    );
  }
}
