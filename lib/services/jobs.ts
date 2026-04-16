// lib/services/jobs.ts
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { jobs } from '@/lib/db/schema';
import { newId } from '@/lib/utils/id';

export type JobType = 'schedule:single-task' | 'schedule:full-run';

export interface EnqueueOptions {
  userId?: string;
  payload?: Record<string, unknown>;
  runAfter?: Date;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export async function enqueueJob(type: JobType, options: EnqueueOptions = {}) {
  const [job] = await db
    .insert(jobs)
    .values({
      id: newId(),
      type,
      userId: options.userId,
      payload: options.payload ?? {},
      runAfter: options.runAfter ?? new Date(),
      idempotencyKey: options.idempotencyKey,
      maxAttempts: options.maxAttempts ?? 3,
    })
    .onConflictDoNothing()
    .returning();
  return job ?? null;
}

export async function claimPendingJobs(limit = 5) {
  const pending = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.status, 'pending'), lte(jobs.runAfter, new Date())))
    .limit(limit);

  if (pending.length === 0) return [];

  return db
    .update(jobs)
    .set({ status: 'running', attempts: sql`${jobs.attempts} + 1`, updatedAt: new Date() })
    .where(inArray(jobs.id, pending.map((j) => j.id)))
    .returning();
}

export async function markJobDone(id: string) {
  await db.update(jobs).set({ status: 'done', updatedAt: new Date() }).where(eq(jobs.id, id));
}

export async function markJobFailed(id: string, error: string, maxAttempts: number, attempts: number) {
  const status = attempts >= maxAttempts ? 'dead' : 'pending';
  await db.update(jobs).set({ status, lastError: error, updatedAt: new Date() }).where(eq(jobs.id, id));
}
