import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/helpers';
import { patchEvent, deleteEvent } from '@/lib/gcal/events';

const PatchEventSchema = z.object({
  calendarId: z.string(),
  summary: z.string().min(1).optional(),
  description: z.string().optional(),
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { calendarId, ...patch } = parsed.data;
  const event = await patchEvent(userId, calendarId, id, patch);
  return NextResponse.json(event);
}

const DeleteEventSchema = z.object({
  calendarId: z.string().min(1),
});

export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = DeleteEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await deleteEvent(userId, parsed.data.calendarId, id);
  return new Response(null, { status: 204 });
}
