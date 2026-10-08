import { config } from './config';
import { supabase } from './supabase';

/**
 * Typed calls to the dvote customer API (/api/app).
 * TODO: replace these hand-written types with packages/api-client once it is generated.
 */

export interface Me {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  /** "YYYY-MM-DD" (a plain date, no time zone) */
  birthDate: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type Gender = 'male' | 'female';

export interface Card {
  id: string;
  vendor: { id: string; name: string; logoUrl: string | null; currency: string };
  balance: number;
  lifetimePoints: number;
  affordableRewards: number;
  nextReward: { id: string; name: string; pointsCost: number; pointsNeeded: number } | null;
  lastActivityAt: string;
}

export interface CardEvent {
  id: string;
  type: 'earn' | 'redeem' | 'adjust';
  delta: number;
  purchaseAmount: string | null;
  branchName: string | null;
  rewardName: string | null;
  createdAt: string;
}

/** A one-time QR to show at the counter. `code` is what gets drawn; it is never shown again. */
export interface NewQrCode {
  id: string;
  code: string;
  expiresAt: string;
}

/** What the staff did with the QR: points added and the card balance afterwards. */
export interface QrCollectResult {
  pointsAdded: number;
  purchaseAmount: string;
  currency: string;
  vendorId: string;
  vendorName: string;
  branchName: string;
  cardId: string;
  cardBalance: number;
  at: string;
}

export interface QrCodeStatus {
  id: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  expiresAt: string;
  result: QrCollectResult | null;
}

/** An error from the API with its stable `code` (e.g. user_blocked). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', "Can't reach dvote right now. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string | string[] };
  if (!res.ok) {
    const code = json.code ?? (res.status === 400 ? 'invalid_input' : `http_${res.status}`);
    const serverMessage = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new ApiError(res.status, code, friendlyMessage(code, serverMessage));
  }
  return json as T;
}

export const api = {
  /** First call after sign-up creates the customer profile. */
  me: () => call<Me>('GET', '/api/app/users/me'),
  /** null clears gender / birthDate; leaving a field out keeps it. */
  updateMe: (body: { name?: string; phone?: string; gender?: Gender | null; birthDate?: string | null }) =>
    call<Me>('PATCH', '/api/app/users/me', body),
  cards: () => call<Card[]>('GET', '/api/app/cards'),
  cardEvents: (cardId: string) => call<CardEvent[]>('GET', `/api/app/cards/${cardId}/events?limit=100`),
  /** Collect QR: works at any shop (the staff who scan it decide the shop). Cancels my older one. */
  newCollectQr: () => call<NewQrCode>('POST', '/api/app/qr-codes', { purpose: 'collect' }),
  qrStatus: (id: string) => call<QrCodeStatus>('GET', `/api/app/qr-codes/${id}`),
  cancelQr: (id: string) => call<QrCodeStatus>('POST', `/api/app/qr-codes/${id}/cancel`),
  /** Adds the feedback to the team's Google Sheet. */
  sendFeedback: (body: { category: FeedbackCategory; message: string }) =>
    call<void>('POST', '/api/app/feedback', body),
};

/** Same codes as the API (CreateFeedbackDto). */
export type FeedbackCategory = 'bug' | 'suggestion' | 'points_rewards' | 'account' | 'other';

export function friendlyMessage(code: string, serverMessage?: string): string {
  const messages: Record<string, string> = {
    user_blocked: 'Your account is blocked. Please contact dvote support.',
    provider_not_allowed: 'This sign-in method is not supported. Use Google, Facebook or email.',
    token_expired: 'Your session expired. Please sign in again.',
    invalid_token: 'Please sign in again.',
    missing_token: 'Please sign in again.',
    card_not_found: 'This card was not found.',
    qr_not_found: 'This QR code was not found. Get a new one.',
    feedback_not_configured: "Feedback isn't available yet. Please try again later.",
  };
  return messages[code] ?? serverMessage ?? 'Something went wrong. Please try again.';
}

/** Codes that mean the sign-in is no longer valid: back to the welcome screen. */
export const SIGN_OUT_CODES = new Set(['token_expired', 'invalid_token', 'missing_token', 'user_blocked', 'provider_not_allowed']);
