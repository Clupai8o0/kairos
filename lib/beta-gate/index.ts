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
