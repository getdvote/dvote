import { Platform } from 'react-native';
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

/** JSON body, or FormData for file uploads (fetch then sets the multipart boundary itself). */
async function call<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
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
  /** Upload or replace my profile photo (the API shrinks it; the old one is deleted). */
  uploadAvatar: async (photo: PickedPhoto) => call<Me>('PUT', '/api/app/users/me/avatar', await photoForm(photo)),
  /** Remove my profile photo. */
  removeAvatar: () => call<Me>('DELETE', '/api/app/users/me/avatar'),
  /** A shop's page: point rule, rewards, menu pages, branches and my card there. */
  vendor: (id: string) => call<VendorPage>('GET', `/api/app/vendors/${id}`),
  /** Adds the feedback to the team's Google Sheet. */
  sendFeedback: (body: { category: FeedbackCategory; message: string }) =>
    call<void>('POST', '/api/app/feedback', body),
};

/** A photo chosen with expo-image-picker. On the web it also carries the browser File. */
export interface PickedPhoto {
  uri: string;
  mimeType?: string;
  fileName?: string | null;
  file?: Blob;
}

/** multipart/form-data with the photo in the field "file", as the API expects. */
async function photoForm(photo: PickedPhoto): Promise<FormData> {
  const form = new FormData();
  const type = photo.mimeType ?? 'image/jpeg';
  const name = photo.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;
  if (Platform.OS === 'web') {
    form.append('file', photo.file ?? (await (await fetch(photo.uri)).blob()), name);
  } else {
    // React Native's FormData reads the file from its uri
    form.append('file', { uri: photo.uri, name, type } as unknown as Blob);
  }
  return form;
}

export interface VendorPageImage {
  id: string;
  url: string;
}

export interface VendorPage {
  id: string;
  name: string;
  logoUrl: string | null;
  currency: string;
  /** null = the shop has no point rule yet */
  rule: { spendAmount: string; pointsPerSpend: number; minPurchase: string; maxPointsPerPurchase: number | null } | null;
  rewards: { id: string; name: string; description: string | null; imageUrl: string | null; pointsCost: number }[];
  menu: VendorPageImage[];
  branches: {
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    photos: VendorPageImage[];
  }[];
  /** My card at this shop; null before my first purchase there */
  card: { id: string; balance: number; lifetimePoints: number } | null;
}

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
    vendor_not_found: 'This shop is not on dvote right now.',
    unsupported_image: 'Choose a JPG, PNG or HEIC photo.',
    file_too_large: 'That photo is too big. Choose one under 10 MB.',
    storage_not_configured: "Photos can't be saved right now. Please try again later.",
    storage_error: "Photos can't be saved right now. Please try again later.",
  };
  return messages[code] ?? serverMessage ?? 'Something went wrong. Please try again.';
}

/** Codes that mean the sign-in is no longer valid: back to the welcome screen. */
export const SIGN_OUT_CODES = new Set(['token_expired', 'invalid_token', 'missing_token', 'user_blocked', 'provider_not_allowed']);
