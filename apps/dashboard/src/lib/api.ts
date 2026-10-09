import type { CityKey } from './cities';
import { config } from './config';
import { supabase } from './supabase';

/**
 * Typed calls to the dvote admin API (/api/admin). Every call sends the signed-in admin's
 * Supabase token. TODO: replace the hand-written types with packages/api-client once generated.
 */

export type VendorStatus = 'active' | 'suspended';
export type BranchStatus = 'active' | 'closed';
export type RewardStatus = 'active' | 'archived';
export type AccountStatus = 'active' | 'disabled';
export type UserStatus = 'active' | 'blocked';
export type StaffRole = 'vendor_admin' | 'branch_manager' | 'staff';

export interface AdminMe {
  id: string;
  name: string;
  email: string;
}

export interface Overview {
  vendorsActive: number;
  vendorsSuspended: number;
  branchesOpen: number;
  customers: number;
  customersBlocked: number;
  customersNew7d: number;
  cards: number;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsOutstanding: number;
  collectsToday: number;
  days: { date: string; pointsEarned: number; collects: number; newCustomers: number }[];
  topVendors: { id: string; name: string; logoUrl: string | null; pointsEarned: number; collects: number }[];
}

export type VendorCategory = 'cafe' | 'cafe_restaurant' | 'restaurant' | 'bakery' | 'desserts' | 'juice_bar';

export interface Vendor {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Shop-page banner in the app. */
  bannerUrl: string | null;
  category: VendorCategory | null;
  /** Loyalty-card design 1-10; null = automatic. */
  cardDesign: number | null;
  contactEmail: string | null;
  currency: string;
  status: VendorStatus;
  branchCount: number;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

/** What a vendor (or a platform admin for it) can set for its look in the app. */
export interface VendorBranding {
  category: VendorCategory | null;
  cardDesign: number | null;
}

export interface Branch {
  id: string;
  vendorId: string;
  name: string;
  address: string | null;
  /** City key (lib/cities.ts) */
  city: CityKey | null;
  lat: number | null;
  lng: number | null;
  timezone: string;
  /** "HH:MM", the same every day; both null = not set. closesAt < opensAt = past midnight. */
  opensAt: string | null;
  closesAt: string | null;
  status: BranchStatus;
  createdAt: string;
}

export interface PointRule {
  id: string;
  version: number;
  spendAmount: string;
  pointsPerSpend: number;
  minPurchase: string;
  maxPointsPerPurchase: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface Reward {
  id: string;
  vendorId: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  pointsCost: number;
  status: RewardStatus;
  sortOrder: number;
  createdAt: string;
}

export interface VendorImage {
  id: string;
  kind: 'menu' | 'branch_photo';
  branchId: string | null;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface Staff {
  id: string;
  vendorId: string;
  branchId: string | null;
  name: string;
  email: string;
  role: StaffRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  avatarUrl: string | null;
  cardsCount: number;
  pointsBalance: number;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  gender: 'male' | 'female' | null;
  birthDate: string | null;
  cards: {
    id: string;
    vendorId: string;
    vendorName: string;
    vendorLogoUrl: string | null;
    balance: number;
    lifetimePoints: number;
    lastActivityAt: string;
  }[];
  events: {
    id: string;
    type: 'earn' | 'redeem' | 'adjust';
    delta: number;
    vendorName: string;
    branchName: string | null;
    purchaseAmount: string | null;
    rewardName: string | null;
    reason: string | null;
    createdAt: string;
  }[];
}

/** The signed-in vendor account (GET /api/vendor/staff/me). */
export interface StaffMe extends Staff {
  vendor: { id: string; name: string; logoUrl: string | null; currency: string };
  branch: { id: string; name: string } | null;
}

export interface VendorSummary {
  collectsToday: number;
  pointsToday: number;
  customers: number;
  newCustomers7d: number;
  pointsEarned30d: number;
  pointsRedeemed30d: number;
  pointsOutstanding: number;
  days: { date: string; pointsEarned: number; collects: number }[];
  branches: { id: string; name: string; collects: number; pointsEarned: number }[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** An error from the API with its stable `code` (e.g. mfa_required). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  network: "Can't reach the dvote API. Is it running?",
  not_admin: 'This account is not a dvote platform admin.',
  admin_disabled: 'This admin account is disabled.',
  mfa_required: 'Two-factor sign-in is required.',
  token_expired: 'Your session expired. Sign in again.',
  invalid_token: 'Sign in again.',
  missing_token: 'Sign in again.',
  vendor_not_found: 'This vendor no longer exists.',
  currency_locked: "The currency can't change once the vendor has a points rule.",
  email_taken: 'This email is already used by another staff account.',
  account_already_staff: 'This account already works at a vendor.',
  email_rate_limited: 'Too many invite emails were sent. Try again in a while.',
  too_many_images: 'Limit reached: delete an image first.',
  unsupported_image: 'Use a JPG, PNG, WebP or HEIC image.',
  file_too_large: 'The image must be under 10 MB.',
  location_incomplete: 'Pick a place on the map, or clear both coordinates.',
  hours_incomplete: 'Set both the opening and closing time, or leave both empty.',
  hours_invalid: 'Opening and closing time can\'t be the same.',
  not_staff: 'This account has no access to the dvote dashboard.',
  staff_disabled: 'This account is disabled. Ask your vendor admin.',
  vendor_suspended: 'This shop is suspended on dvote. Contact dvote support.',
  branch_closed: 'Your branch is closed.',
  forbidden_role: "Your role can't do this.",
  forbidden_branch: 'That belongs to another branch.',
  cannot_modify_self: "You can't change your own account here.",
};

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', MESSAGES.network);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string | string[] };
  if (!res.ok) {
    const code = json.code ?? `http_${res.status}`;
    const server = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new ApiError(res.status, code, MESSAGES[code] ?? server ?? 'Something went wrong.');
  }
  return json as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

const file = (f: File, fields: Record<string, string | undefined> = {}) => {
  const form = new FormData();
  form.append('file', f);
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
  return form;
};

export const api = {
  me: () => call<AdminMe>('GET', '/api/admin/me'),
  overview: () => call<Overview>('GET', '/api/admin/overview'),

  vendors: (q: { search?: string; status?: VendorStatus } = {}) => call<Vendor[]>('GET', `/api/admin/vendors${qs(q)}`),
  vendor: (id: string) => call<Vendor>('GET', `/api/admin/vendors/${id}`),
  createVendor: (body: { name: string; contactEmail?: string; currency?: string; category?: VendorCategory }) =>
    call<Vendor>('POST', '/api/admin/vendors', body),
  updateVendor: (id: string, body: Partial<{ name: string; contactEmail: string | null; currency: string; status: VendorStatus } & VendorBranding>) =>
    call<Vendor>('PATCH', `/api/admin/vendors/${id}`, body),
  uploadLogo: (id: string, f: File) => call<Vendor>('PUT', `/api/admin/vendors/${id}/logo`, file(f)),
  removeLogo: (id: string) => call<Vendor>('DELETE', `/api/admin/vendors/${id}/logo`),
  uploadBanner: (id: string, f: File) => call<Vendor>('PUT', `/api/admin/vendors/${id}/banner`, file(f)),
  removeBanner: (id: string) => call<Vendor>('DELETE', `/api/admin/vendors/${id}/banner`),
  inviteVendorAdmin: (id: string, body: { name: string; email: string }) =>
    call<Staff & { invited: boolean }>('POST', `/api/admin/vendors/${id}/admins`, body),

  branches: (vendorId: string) => call<Branch[]>('GET', `/api/admin/vendors/${vendorId}/branches`),
  createBranch: (vendorId: string, body: Partial<Branch>) => call<Branch>('POST', `/api/admin/vendors/${vendorId}/branches`, body),
  updateBranch: (id: string, body: Partial<Branch>) => call<Branch>('PATCH', `/api/admin/branches/${id}`, body),

  pointRules: (vendorId: string) => call<PointRule[]>('GET', `/api/admin/vendors/${vendorId}/point-rules`),
  publishRule: (
    vendorId: string,
    body: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null },
  ) => call<PointRule>('POST', `/api/admin/vendors/${vendorId}/point-rules`, body),
  deactivateRule: (vendorId: string) => call<void>('DELETE', `/api/admin/vendors/${vendorId}/point-rules/active`),

  rewards: (vendorId: string) => call<Reward[]>('GET', `/api/admin/vendors/${vendorId}/rewards`),
  createReward: (vendorId: string, body: Partial<Reward>) => call<Reward>('POST', `/api/admin/vendors/${vendorId}/rewards`, body),
  updateReward: (id: string, body: Partial<Reward>) => call<Reward>('PATCH', `/api/admin/rewards/${id}`, body),
  uploadRewardImage: (id: string, f: File) => call<Reward>('PUT', `/api/admin/rewards/${id}/image`, file(f)),
  removeRewardImage: (id: string) => call<Reward>('DELETE', `/api/admin/rewards/${id}/image`),

  images: (vendorId: string) => call<VendorImage[]>('GET', `/api/admin/vendors/${vendorId}/images`),
  uploadImage: (vendorId: string, f: File, kind: VendorImage['kind'], branchId?: string) =>
    call<VendorImage>('POST', `/api/admin/vendors/${vendorId}/images`, file(f, { kind, branchId })),
  deleteImage: (vendorId: string, imageId: string) => call<void>('DELETE', `/api/admin/vendors/${vendorId}/images/${imageId}`),

  staff: (vendorId: string) => call<Staff[]>('GET', `/api/admin/vendors/${vendorId}/staff`),
  updateStaff: (id: string, body: { name?: string; status?: AccountStatus }) => call<Staff>('PATCH', `/api/admin/staff/${id}`, body),

  users: (q: { search?: string; status?: UserStatus; page?: number; pageSize?: number }) =>
    call<Page<UserListItem>>('GET', `/api/admin/users${qs(q)}`),
  user: (id: string) => call<UserDetail>('GET', `/api/admin/users/${id}`),
  setUserStatus: (id: string, status: UserStatus) => call<UserDetail>('PATCH', `/api/admin/users/${id}`, { status }),
};

/**
 * The signed-in vendor account's own data (/api/vendor). No vendor id is ever sent: the API takes
 * it from the token, so a Starbucks account can only ever reach Starbucks.
 */
export const vendorApi = {
  me: () => call<StaffMe>('GET', '/api/vendor/staff/me'),
  summary: () => call<VendorSummary>('GET', '/api/vendor/summary'),

  profile: () => call<Vendor>('GET', '/api/vendor/profile'),
  updateProfile: (body: { name?: string; contactEmail?: string | null } & Partial<VendorBranding>) =>
    call<Vendor>('PATCH', '/api/vendor/profile', body),
  uploadLogo: (f: File) => call<Vendor>('PUT', '/api/vendor/profile/logo', file(f)),
  removeLogo: () => call<Vendor>('DELETE', '/api/vendor/profile/logo'),
  uploadBanner: (f: File) => call<Vendor>('PUT', '/api/vendor/profile/banner', file(f)),
  removeBanner: () => call<Vendor>('DELETE', '/api/vendor/profile/banner'),

  branches: () => call<Branch[]>('GET', '/api/vendor/branches'),
  createBranch: (body: Partial<Branch>) => call<Branch>('POST', '/api/vendor/branches', body),
  updateBranch: (id: string, body: Partial<Branch>) => call<Branch>('PATCH', `/api/vendor/branches/${id}`, body),

  pointRules: () => call<PointRule[]>('GET', '/api/vendor/point-rules'),
  publishRule: (body: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null }) =>
    call<PointRule>('POST', '/api/vendor/point-rules', body),
  deactivateRule: () => call<void>('DELETE', '/api/vendor/point-rules/active'),

  rewards: () => call<Reward[]>('GET', '/api/vendor/rewards'),
  createReward: (body: Partial<Reward>) => call<Reward>('POST', '/api/vendor/rewards', body),
  updateReward: (id: string, body: Partial<Reward>) => call<Reward>('PATCH', `/api/vendor/rewards/${id}`, body),
  uploadRewardImage: (id: string, f: File) => call<Reward>('PUT', `/api/vendor/rewards/${id}/image`, file(f)),
  removeRewardImage: (id: string) => call<Reward>('DELETE', `/api/vendor/rewards/${id}/image`),

  images: () => call<VendorImage[]>('GET', '/api/vendor/images'),
  uploadImage: (f: File, kind: VendorImage['kind'], branchId?: string) =>
    call<VendorImage>('POST', '/api/vendor/images', file(f, { kind, branchId })),
  deleteImage: (id: string) => call<void>('DELETE', `/api/vendor/images/${id}`),

  staff: () => call<Staff[]>('GET', '/api/vendor/staff'),
  inviteStaff: (body: { name: string; email: string; role: StaffRole; branchId?: string }) =>
    call<Staff & { invited: boolean }>('POST', '/api/vendor/staff', body),
  updateStaff: (id: string, body: { name?: string; status?: AccountStatus }) => call<Staff>('PATCH', `/api/vendor/staff/${id}`, body),
};

/** A readable message for any error thrown by an API call or Supabase. */
export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
