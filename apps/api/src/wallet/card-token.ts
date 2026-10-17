import { createHash, createHmac } from 'node:crypto';

/** Prefix of the QR printed on a wallet pass (the paused app's one-time QRs use `dvote:q1:`). */
export const CARD_QR_PREFIX = 'dvote:c1:';

/**
 * The secret in a card's wallet QR: 128 bits derived from WALLET_TOKEN_SECRET and the card id, so
 * the same code can be put on the pass again (Google save link, Apple pass refresh) without
 * storing it. Only its SHA-256 is saved (`cards.token_hash`), like the one-time QR codes.
 */
export function cardSecret(walletSecret: string, cardId: string): string {
  return createHmac('sha256', walletSecret).update(`card:${cardId}`).digest().subarray(0, 16).toString('base64url');
}

export const cardQr = (secret: string) => CARD_QR_PREFIX + secret;
export const hashCardSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');
