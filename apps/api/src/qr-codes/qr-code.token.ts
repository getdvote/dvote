import { createHash, randomBytes } from 'node:crypto';

/**
 * One-time QR codes. The QR shows `dvote:q1:<secret>`: 128 random bits, nothing about the
 * customer. Only the SHA-256 of the secret is stored (qr_codes.token_hash), so a database
 * leak can't be turned into usable QR codes.
 */
export const QR_PREFIX = 'dvote:q1:';
const SECRET = /^[A-Za-z0-9_-]{22}$/; // 16 bytes in base64url

export function newQrCode(): { code: string; tokenHash: string } {
  const secret = randomBytes(16).toString('base64url');
  return { code: QR_PREFIX + secret, tokenHash: hashSecret(secret) };
}

/** The stored hash for a scanned QR text, or null if it isn't a dvote QR. */
export function tokenHashOf(code: string): string | null {
  const text = code.trim();
  if (!text.startsWith(QR_PREFIX)) return null;
  const secret = text.slice(QR_PREFIX.length);
  return SECRET.test(secret) ? hashSecret(secret) : null;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
