import { Platform } from 'react-native';
import { errorText, t } from '../i18n';
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
  vendor: { id: string; name: string; logoUrl: string | null; currency: string; cardDesign: number | null };
  balance: number;
  lifetimePoints: number;
  affordableRewards: number;
  nextReward: { id: string; name: string; nameAr: string | null; pointsCost: number; pointsNeeded: number } | null;
  lastActivityAt: string;
  /** When the card was made: the first purchase at this shop. */
  createdAt: string;
}

export interface CardEvent {
  id: string;
  type: 'earn' | 'redeem' | 'adjust';
  delta: number;
  purchaseAmount: string | null;
  branchName: string | null;
  rewardName: string | null;
  rewardNameAr: string | null;
  createdAt: string;
}

/** A one-time QR to show at the counter. `code` is what gets drawn; it is never shown again. */
export interface NewQrCode {
  id: string;
  code: string;
  expiresAt: string;
  /** Redeem QRs: the reward it is for. */
  reward?: { id: string; name: string; nameAr: string | null; pointsCost: number; imageUrl: string | null; vendorName: string } | null;
}

/** How often and when I redeemed one reward. */
export interface RewardHistory {
  count: number;
  pointsSpent: number;
  items: { id: string; at: string; branchName: string; pointsCost: number; rewardName: string }[];
}

/** Staff confirmed a redeem QR: the reward was given and its points taken. */
export interface QrRedeemResult {
  rewardName: string;
  rewardNameAr: string | null;
  pointsRedeemed: number;
  vendorId: string;
  vendorName: string;
  branchName: string;
  cardId: string;
  cardBalance: number;
  at: string;
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
  /** Redeem QRs, once staff confirmed. */
  redeemResult?: QrRedeemResult | null;
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
    throw new ApiError(0, 'network', t('errors.network'));
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
  /** Where I am now (sent when the app opens, with permission): used for shops near me. */
  setLocation: (lat: number, lng: number) => call<void>('PUT', '/api/app/users/me/location', { lat, lng }),
  /** Shops near my last sent location, nearest first. */
  nearbyVendors: (limit = 5) => call<NearbyVendors>('GET', `/api/app/vendors/nearby?limit=${limit}`),
  updateMe: (body: { name?: string; phone?: string; gender?: Gender | null; birthDate?: string | null }) =>
    call<Me>('PATCH', '/api/app/users/me', body),
  cards: () => call<Card[]>('GET', '/api/app/cards'),
  /** A card's history, newest first. `before`: the last event id already shown (next page). */
  cardEvents: (cardId: string, limit: number, before?: string) =>
    call<CardEvent[]>('GET', `/api/app/cards/${cardId}/events?limit=${limit}${before ? `&before=${before}` : ''}`),
  /** Collect QR: works at any shop (the staff who scan it decide the shop). Cancels my older one. */
  /** No vendorId: master QR (any shop). vendorId: shop QR, only that shop can scan it. */
  newCollectQr: (vendorId?: string) =>
    call<NewQrCode>('POST', '/api/app/qr-codes', vendorId ? { purpose: 'collect', vendorId } : { purpose: 'collect' }),
  /** My own redemptions of one reward (newest first). */
  rewardHistory: (rewardId: string) => call<RewardHistory>('GET', `/api/app/rewards/${rewardId}/history`),
  /** A one-time QR to get a reward; only the reward's shop can confirm it. */
  newRedeemQr: (rewardId: string) => call<NewQrCode>('POST', '/api/app/qr-codes', { purpose: 'redeem', rewardId }),
  qrStatus: (id: string) => call<QrCodeStatus>('GET', `/api/app/qr-codes/${id}`),
  cancelQr: (id: string) => call<QrCodeStatus>('POST', `/api/app/qr-codes/${id}/cancel`),
  /** Upload or replace my profile photo (the API shrinks it; the old one is deleted). */
  uploadAvatar: async (photo: PickedPhoto) => call<Me>('PUT', '/api/app/users/me/avatar', await photoForm(photo)),
  /** Remove my profile photo. */
  removeAvatar: () => call<Me>('DELETE', '/api/app/users/me/avatar'),
  /** Explore: every active shop A–Z (optionally filtered by name). */
  vendors: (search?: string) =>
    call<VendorListItem[]>('GET', `/api/app/vendors${search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`),
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

/** One shop in the Explore list. */
/** Shops near me: located=false until the app has sent a location once. */
export interface NearbyVendors {
  located: boolean;
  items: (VendorListItem & { distanceKm: number; nearestBranch: string })[];
}

/** What kind of place a shop is (set in the dashboards). */
export type VendorCategory = 'cafe' | 'cafe_restaurant' | 'restaurant' | 'bakery' | 'desserts' | 'juice_bar';

export interface VendorListItem {
  id: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  category: VendorCategory | null;
  cardDesign: number | null;
  currency: string;
  /** null = the shop has no point rule yet */
  rule: { spendAmount: string; pointsPerSpend: number } | null;
  rewardsCount: number;
  branchesCount: number;
  /** address of the first open branch, as a hint of where the shop is */
  firstAddress: string | null;
  /** my points there; null before my first purchase */
  myBalance: number | null;
}

export interface VendorPageImage {
  id: string;
  url: string;
}

export interface VendorPage {
  id: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  category: VendorCategory | null;
  cardDesign: number | null;
  currency: string;
  /** null = the shop has no point rule yet */
  rule: { spendAmount: string; pointsPerSpend: number; minPurchase: string; maxPointsPerPurchase: number | null } | null;
  rewards: {
    id: string;
    name: string;
    description: string | null;
    /** Arabic texts (null = not translated; the app shows the English ones) */
    nameAr: string | null;
    descriptionAr: string | null;
    imageUrl: string | null;
    pointsCost: number;
    /** Open branches where it is sold out right now (until: back at; null = no time given). Empty = everywhere. */
    soldOutAt: { branchId: string; branchName: string; until: string | null }[];
    /** Sold out at every open branch: can't be redeemed anywhere right now. */
    soldOutEverywhere: boolean;
  }[];
  menu: VendorPageImage[];
  branches: {
    id: string;
    name: string;
    address: string | null;
    /** City key: show with cityName() (lib/cities.ts) */
    city: string | null;
    lat: number | null;
    lng: number | null;
    /** Legacy: "HH:MM" only when every day has the same single slot; use `hours`. closesAt < opensAt = past midnight */
    opensAt: string | null;
    closesAt: string | null;
    /** Per weekday (0 = Sunday), several a day = split shifts, no slot = closed that day; null = not set. */
    hours: { day: number; opensAt: string; closesAt: string }[] | null;
    /** Temporarily closed until (only while ahead). */
    pausedUntil: string | null;
    photos: VendorPageImage[];
  }[];
  /** My card at this shop; null before my first purchase there */
  card: { id: string; balance: number; lifetimePoints: number } | null;
}

/** Same codes as the API (CreateFeedbackDto). */
export type FeedbackCategory = 'bug' | 'suggestion' | 'points_rewards' | 'account' | 'other';

/** The message shown for an API error code, in the app language (i18n errors.*). */
export function friendlyMessage(code: string, serverMessage?: string): string {
  return errorText(code) ?? serverMessage ?? t('common.somethingWrong');
}

/** Codes that mean the sign-in is no longer valid: back to the welcome screen. */
export const SIGN_OUT_CODES = new Set(['token_expired', 'invalid_token', 'missing_token', 'user_blocked', 'provider_not_allowed']);
