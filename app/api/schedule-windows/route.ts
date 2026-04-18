// app/api/schedule-windows/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { listScheduleWindows, setScheduleWindows } from '@/lib/services/schedule-windows';

const WindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  templateId: z.string(),
});

const PutSchema = z.object({
  windows: z.array(WindowSchema),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const windows = await listScheduleWindows(userId);
  return NextResponse.json(windows);
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const windows = await setScheduleWindows(userId, parsed.data.windows);
  return NextResponse.json(windows);
}
