import { errorText, t } from '../i18n';
import { config } from './config';

/** Calls to the dvote API's public routes (/api/public). Types mirror src/public-join/dto. */

export interface PublicVendor {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  category: string | null;
  cardDesign: number | null;
  currency: string;
  rule: { spendAmount: string; pointsPerSpend: number } | null;
  rewards: { name: string; nameAr: string | null; pointsCost: number; imageUrl: string | null }[];
  branches: { id: string; name: string; address: string | null; mapsUrl: string | null }[];
  /** Settings → Branding. Colours #rrggbb or null (= the card colours); font = a Google Fonts family. */
  style: { pageStyle: PageStyle; primary: string | null; secondary: string | null; font: string | null };
  /** The page sections in order (the branch's own copy when opened with ?b=). */
  sections: Section[];
  /** Menu page images, in order. */
  menu: string[];
}

export type PageStyle = 'spotlight' | 'compact' | 'branded' | 'playful' | 'split';
export type Section =
  | { type: 'loyalty'; label: 'loyalty_card' | 'join_club' | 'collect_points' }
  | { type: 'rewards' }
  | { type: 'menu' }
  | { type: 'branches' }
  | { type: 'wifi'; ssid: string; security: 'wpa' | 'wep' | 'none'; password: string };

export interface PublicCard {
  publicId: string;
  shortCode: string;
  cardholder: string;
  balance: number;
  vendor: Pick<PublicVendor, 'id' | 'slug' | 'name' | 'logoUrl' | 'bannerUrl' | 'cardDesign' | 'currency'>;
  createdAt: string;
}

export type JoinSource = 'nfc' | 'qr' | 'link';
export const HEARD_FROM = ['friend', 'social_media', 'walking_by', 'google_maps', 'other'] as const;
export type HeardFrom = (typeof HEARD_FROM)[number];

export interface JoinBody {
  name: string;
  phone: string;
  email?: string;
  ageConfirmed?: boolean;
  heardFrom?: HeardFrom;
  branchId?: string;
  source: JoinSource;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', t('errors.network'));
  }
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string | string[] };
  if (!res.ok) {
    const code = json.code ?? `http_${res.status}`;
    const server = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new ApiError(res.status, code, errorText(code) ?? server ?? t('errors.generic'));
  }
  return json as T;
}

export const api = {
  vendor: (slug: string, branch?: string | null) =>
    call<PublicVendor>('GET', `/api/public/vendors/${encodeURIComponent(slug)}${branch ? `?b=${encodeURIComponent(branch)}` : ''}`),
  /** Join, or get the card back (same email + same mobile). No sign-in. */
  join: (slug: string, body: JoinBody) =>
    call<{ created: boolean; card: PublicCard }>('POST', `/api/public/vendors/${encodeURIComponent(slug)}/join`, body),
  card: (publicId: string) => call<PublicCard>('GET', `/api/public/cards/${encodeURIComponent(publicId)}`),
  /** Signed "Add to Google Wallet" link for this card (503 wallet_not_configured until set up). */
  /** Is the card already saved in Google / Apple Wallet? */
  walletStatus: (publicId: string) => call<{ google: boolean; apple: boolean }>('GET', `/api/public/cards/${encodeURIComponent(publicId)}/wallet-status`),
  googleWallet: (publicId: string) => call<{ saveUrl: string }>('GET', `/api/public/cards/${encodeURIComponent(publicId)}/google-wallet`),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : t('errors.generic'));
