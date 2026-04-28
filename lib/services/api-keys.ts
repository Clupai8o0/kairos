// lib/services/api-keys.ts — Developer API key management
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { apiKeys } from '@/lib/db/schema';

export type ApiKeyScope =
  | 'tasks:read'
  | 'tasks:write'
  | 'schedule:run'
  | 'gcal:sync'
  | 'tags:read'
  | 'tags:write'
  | 'collections:read'
  | 'collections:write'
  | '*';

export const ALL_SCOPES: ApiKeyScope[] = [
  'tasks:read', 'tasks:write',
  'schedule:run',
  'gcal:sync',
  'tags:read', 'tags:write',
  'collections:read', 'collections:write',
];

function generateRawKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `kairos_sk_${hex}`;
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
}

export interface ApiKeyRow {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
): Promise<ApiKeyRow & { key: string }> {
  const raw = generateRawKey();
  const hash = await sha256hex(raw);
  const prefix = raw.slice(0, 20);

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId,
      name: input.name,
      keyHash: hash,
      prefix,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return { ...row, key: raw };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  return db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);
}

export async function deleteApiKey(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  return result.length > 0;
}

export async function verifyApiKey(rawKey: string): Promise<{ userId: string } | null> {
  if (!rawKey.startsWith('kairos_sk_')) return null;

  const hash = await sha256hex(rawKey);
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});

  return { userId: row.userId };
}
