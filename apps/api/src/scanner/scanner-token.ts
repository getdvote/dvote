import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Marks a phone session token, so the guards can tell it from a Supabase JWT. */
export const SESSION_PREFIX = 'dvs_';

/** 128 bits, in the QR's URL fragment: identifies the pairing and can't be guessed. */
export const newPairSecret = (): string => randomBytes(16).toString('hex');

/** The 6 digits shown on the laptop only, never in the QR. */
export const newPairCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** 256 bits, kept on the phone; authorises scanning for up to 12 hours. */
export const newSessionToken = (): string => `${SESSION_PREFIX}${randomBytes(32).toString('hex')}`;

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** The code alone has too few values to hash safely, so it is hashed with the secret. */
export const hashCode = (secret: string, code: string): string => sha256(`${secret}:${code}`);

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
