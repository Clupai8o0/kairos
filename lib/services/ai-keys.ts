// lib/services/ai-keys.ts — CRUD for per-user LLM API keys
import { db } from '@/lib/db/client';
import { userAiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/utils/crypto';

export type AiProvider = 'openai' | 'anthropic' | 'google';
const VALID_PROVIDERS: AiProvider[] = ['openai', 'anthropic', 'google'];

export function isValidProvider(p: string): p is AiProvider {
  return VALID_PROVIDERS.includes(p as AiProvider);
}

/** List which providers the user has configured (no plaintext keys returned). */
export async function listUserKeys(userId: string): Promise<{ provider: AiProvider; hasKey: boolean; updatedAt: Date }[]> {
  const rows = await db
    .select({ provider: userAiKeys.provider, updatedAt: userAiKeys.updatedAt })
    .from(userAiKeys)
    .where(eq(userAiKeys.userId, userId));
  return rows.map((r) => ({ provider: r.provider as AiProvider, hasKey: true, updatedAt: r.updatedAt }));
}

/** Upsert an API key for a provider. */
export async function setUserKey(userId: string, provider: AiProvider, apiKey: string): Promise<void> {
  const encrypted = encrypt(apiKey);
  const existing = await db
    .select({ id: userAiKeys.id })
    .from(userAiKeys)
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userAiKeys)
      .set({ encryptedKey: encrypted, updatedAt: new Date() })
      .where(eq(userAiKeys.id, existing[0].id));
  } else {
    await db.insert(userAiKeys).values({
      userId,
      provider,
      encryptedKey: encrypted,
    });
  }
}

/** Delete a user's key for a provider. */
export async function deleteUserKey(userId: string, provider: AiProvider): Promise<boolean> {
  const result = await db
    .delete(userAiKeys)
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)))
    .returning({ id: userAiKeys.id });
  return result.length > 0;
}

/** Get the decrypted API key for a provider. Returns null if not set. */
export async function getUserKey(userId: string, provider: AiProvider): Promise<string | null> {
  const [row] = await db
    .select({ encryptedKey: userAiKeys.encryptedKey })
    .from(userAiKeys)
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)))
    .limit(1);
  if (!row) return null;
  return decrypt(row.encryptedKey);
}
