// lib/utils/crypto.ts — AES-256-GCM encryption for user API keys
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getSecret(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set and at least 32 characters.');
  }
  // Use first 32 bytes as key
  return Buffer.from(secret.slice(0, 32), 'utf8');
}

/** Encrypt plaintext → base64 string (iv:ciphertext:tag) */
export function encrypt(plaintext: string): string {
  const key = getSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Concatenate iv + encrypted + tag, encode as base64
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/** Decrypt base64 string → plaintext */
export function decrypt(encoded: string): string {
  const key = getSecret();
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
