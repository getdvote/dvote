import type { CityKey } from './cities';
import { config } from './config';
import { errorText, t } from '../i18n';
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
export type StaffRole = 'vendor_admin' | 'branch_manager' | 'staff' | 'viewer';

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

/** Database + storage sizes and the database server's RAM / disk / load. */
export interface SystemDatabase {
  sizeBytes: number;
  version: string;
  connections: number;
  maxConnections: number;
  cacheHitPercent: number | null;
  authUsers: number;
  tables: { name: string; rows: number; sizeBytes: number }[];
  storage: { bucket: string; files: number; sizeBytes: number }[];
  server: {
    memoryTotalBytes: number | null;
    memoryAvailableBytes: number | null;
    diskTotalBytes: number | null;
    diskAvailableBytes: number | null;
    load1: number | null;
    load5: number | null;
    load15: number | null;
    cpus: number | null;
  } | null;
  checkedAt: string;
}

export type FraudType = 'too_many_collects' | 'large_purchase' | 'branch_spike' | 'staff_spike';
export type FraudStatus = 'open' | 'dismissed' | 'confirmed';

/** A risk finding from the fraud check (never blocks anything by itself). */
export interface FraudFlag {
  id: string;
  type: FraudType;
  status: FraudStatus;
  vendor: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  user: { id: string; name: string; email: string | null; status: UserStatus } | null;
  staff: { id: string; name: string } | null;
  details: Record<string, unknown> & { day?: string; review?: { note: string | null; at: string } };
  reviewedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface FraudSummary {
  open: number;
  openByType: Record<FraudType, number>;
  confirmed: number;
  dismissed: number;
  last7d: number;
  lastCheckAt: string | null;
  rules: Record<string, number>;
}

/** Which parts of dvote are up. */
export interface SystemStatus {
  checks: { name: string; kind: 'api' | 'database' | 'auth' | 'storage' | 'website'; up: boolean; latencyMs: number; detail: string; url?: string }[];
  checkedAt: string;
}

/** Collects split by the QR that was scanned: master QR (tab bar, any shop) vs shop QR (a shop's page). */
export interface QrSources {
  days: number;
  master: { collects: number; points: number };
  shop: { collects: number; points: number };
  daily: { date: string; master: number; shop: number }[];
  vendors: { id: string; name: string; logoUrl: string | null; master: number; shop: number }[];
}

export interface Vendor {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Public page address on the customer website: <web>/<slug> (empty = none yet). */
  slug: string;
  /** Shop-page banner in the app. */
  bannerUrl: string | null;
  category: VendorCategory | null;
  /** Loyalty-card design 1-10; null = automatic. */
  cardDesign: number | null;
  contactEmail: string | null;
  /** Shop contact phone, e.g. +201001234567. */
  contactPhone: string | null;
  /** Public page look (Settings → Branding); null = defaults. */
  pageStyle: PageStyle | null;
  brandPrimary: string | null;
  brandSecondary: string | null;
  brandFont: BrandFont | null;
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
  /** Legacy: "HH:MM" only when every day has the same single slot (use `hours`). */
  opensAt: string | null;
  closesAt: string | null;
  /** Per weekday, sorted; several a day = split shifts; a day without slots is closed; null = not set. */
  hours: HoursSlot[] | null;
  /** Temporarily closed until (only while ahead). */
  pausedUntil: string | null;
  status: BranchStatus;
  createdAt: string;
}

/** One opening slot: day 0 = Sunday … 6 = Saturday; closesAt < opensAt = past midnight (a day's last slot only). */
export interface HoursSlot {
  day: number;
  opensAt: string;
  closesAt: string;
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
  retailValue: string | null;
  status: RewardStatus;
  sortOrder: number;
  createdAt: string;
}

export type RewardBody = Omit<Partial<Reward>, 'retailValue'> & { retailValue?: number | null };

/** A reward sold out at one open branch right now (until: back on sale at; null = until turned back on). */
export interface SoldOut {
  rewardId: string;
  branchId: string;
  branchName: string;
  until: string | null;
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
    cardId: string;
    /** A collect an admin already undid. */
    reversed: boolean;
    /** The admin who made an adjust row. */
    adminName: string | null;
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

export type UserEvent = UserDetail['events'][number];

/** Result of an admin point correction (one new adjust row in the ledger). */
export interface AdjustResult {
  pointEventId: string;
  cardId: string;
  delta: number;
  cardBalance: number;
  lifetimePoints: number;
  reason: string;
  at: string;
}

/** The signed-in vendor account (GET /api/vendor/staff/me). */
export interface StaffMe extends Staff {
  vendor: { id: string; name: string; logoUrl: string | null; currency: string };
  branch: { id: string; name: string } | null;
  /** Active branches this account can work at (all of them for a merchant admin). */
  branches: { id: string; name: string }[];
  activeRule: {
    version: number;
    spendAmount: string;
    pointsPerSpend: number;
    minPurchase: string;
    maxPointsPerPurchase: number | null;
  } | null;
}

/** GET /api/vendor/insights/patterns: fixed windows, not the page's date range. */
export interface VendorPatterns {
  /** Last 365 days, most visit days then most spent. */
  topMembers: { customerRef: string; name: string | null; visits: number; points: number; rewards: number; spent: string; lastSeen: string }[];
  /** Last 12 weeks, Cairo time; day 0 = Sunday. Only hours with activity. */
  busiestHours: { day: number; hour: number; count: number }[];
  /** Last 6 months, oldest first; returned[k-1] = share seen again k months later (null = not yet). */
  cohorts: { month: string; size: number; returned: (number | null)[] }[];
  updatedAt: string;
}

/** POST /api/vendor/scans/preview: what a scanned customer QR is. Changes nothing. */
export interface ScanPreview {
  purpose: 'collect' | 'redeem';
  usable: boolean;
  reason: string | null;
  expiresAt: string;
  redeem?: RedeemPreview | null;
}

export interface RedeemPreview {
  rewardId: string;
  rewardName: string;
  rewardNameAr: string | null;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  pointsCost: number;
  customerName: string | null;
  balance: number;
  balanceAfter: number;
}

export interface CollectResult {
  pointEventId: string;
  pointsAdded: number;
  purchaseAmount: string;
  currency: string;
  branchName: string;
  at: string;
}

export interface RedeemResult {
  redemptionId: string;
  rewardName: string;
  pointsRedeemed: number;
  cardBalance: number;
  branchName: string;
  at: string;
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

export type PointEventType = 'earn' | 'redeem' | 'adjust';

/** One row of my vendor's ledger (GET /api/vendor/events). The customer is a card code, never a name. */
export interface ActivityItem {
  id: string;
  type: PointEventType;
  points: number;
  amount: string | null;
  receiptRef: string | null;
  branch: { id: string; name: string } | null;
  staff: { id: string; name: string } | null;
  reward: { id: string; name: string } | null;
  reason: string | null;
  customerRef: string;
  createdAt: string;
}

export interface ActivityQuery {
  eventId?: string;
  type?: PointEventType;
  branchId?: string;
  staffId?: string;
  from?: string;
  to?: string;
  receipt?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityPage extends Page<ActivityItem> {
  /** For every row matching the filters, not just this page. */
  totals: { collects: number; redemptions: number; pointsEarned: number; pointsRedeemed: number; sales: string };
}

/** One reward given at my shops (GET /api/vendor/redemptions). Name and cost as they were then. */
export interface RedemptionItem {
  id: string;
  rewardId: string;
  rewardName: string;
  imageUrl: string | null;
  pointsCost: number;
  branch: { id: string; name: string };
  staff: { id: string; name: string };
  customerRef: string;
  createdAt: string;
}

export interface RedemptionQuery {
  rewardId?: string;
  branchId?: string;
  staffId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface RedemptionPage extends Page<RedemptionItem> {
  totals: { redemptions: number; points: number; customers: number };
  /** Per reward for the period/branch/staff (ignores the reward filter), most given first. */
  byReward: { rewardId: string; name: string; imageUrl: string | null; status: RewardStatus; count: number; points: number }[];
}

export type GoLiveStep = 'logo' | 'banner' | 'rule' | 'reward' | 'branch_hours' | 'staff' | 'test_scan';
/** Go-live checklist for a new merchant (GET /api/vendor/go-live, merchant admin only). */
export interface GoLive {
  /** In the order to do them; `to` is the dashboard path. */
  steps: { key: GoLiveStep; done: boolean; to: string }[];
  done: number;
  total: number;
  live: boolean;
  /** Active rewards, and how many have a photo / an Arabic name. */
  rewards: { active: number; withPhoto: number; withArabic: number };
  firstScanAt: string | null;
}

/** One "needs your attention" item on the dashboard home (GET /api/vendor/attention). */
export interface AttentionItem {
  key: string;
  /** now = affects customers / operations today; setup = profile still incomplete */
  group: 'now' | 'setup';
  tone: 'critical' | 'warning' | 'info';
  title: string;
  detail: string | null;
  action: { label: string; to: string };
  /** Names, counts and times in the text, for wording it in the dashboard language. */
  params?: Record<string, string | number>;
}

/** The public page (customer website): sections in order; see lib/storefront.ts. */
export type PageStyle = 'spotlight' | 'compact' | 'branded' | 'playful' | 'split';
export type BrandFont = 'inter' | 'poppins' | 'montserrat' | 'dm_sans' | 'playfair' | 'lora' | 'cairo' | 'tajawal' | 'almarai' | 'ibm_plex_arabic';
export type StorefrontSection =
  | { type: 'loyalty'; label: 'loyalty_card' | 'join_club' | 'collect_points' }
  | { type: 'rewards' }
  | { type: 'menu' }
  | { type: 'branches' }
  | { type: 'feedback'; placeholder?: { en: string; ar: string } }
  | { type: 'wifi'; ssid: string; security: 'wpa' | 'wep' | 'none'; password: string };
export interface Storefront {
  sections: StorefrontSection[];
}
export interface StorefrontSettings {
  shop: Storefront;
  /** Open branches; storefront null = uses the shop's. */
  branches: { id: string; name: string; storefront: Storefront | null }[];
}

/** How a merchant feels about dvote (quick feedback). */
export type MerchantMood = 'love' | 'okay' | 'unhappy';

/** Quick feedback a merchant team member sent from Get help (admin Feedback page). */
export interface MerchantFeedback {
  id: string;
  createdAt: string;
  mood: MerchantMood | null;
  message: string;
  vendor: { id: string; name: string; logoUrl: string | null };
  staff: { name: string; email: string; role: string };
}

export type CustomerSegment = 'champions' | 'regulars' | 'new' | 'never_visited' | 'slipping' | 'at_risk' | 'lost';

/** What a custom segment's rules can look at. */
export type SegmentRuleField =
  | 'visits'
  | 'visits_30d'
  | 'spend'
  | 'days_since_visit'
  | 'days_since_joined'
  | 'points'
  | 'rewards_redeemed'
  | 'segment';
export interface SegmentRule {
  field: SegmentRuleField;
  op: 'gte' | 'lte' | 'eq' | 'is' | 'is_not';
  value: number | string;
}
export interface CustomSegment {
  id: string;
  name: string;
  description: string | null;
  match: 'all' | 'any';
  rules: SegmentRule[];
  sortOrder: number;
  /** Customers showing this segment, in the current scope. */
  count: number;
}
export interface CustomSegmentInput {
  name: string;
  description?: string | null;
  match: 'all' | 'any';
  rules: SegmentRule[];
}
export interface MerchantCustomer {
  id: string;
  reference: string;
  name: string | null;
  segment: CustomerSegment;
  /** At most one: added by hand (manual) or matched by the rules. */
  customSegment: { id: string; name: string; manual: boolean } | null;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  visits: number;
  visits90d: number;
  spend: string;
  averageBill: string;
  rewardsRedeemed: number;
  pointsBalance: number | null;
}
export interface MerchantCustomerQuery {
  branchId?: string;
  search?: string;
  segment?: CustomerSegment;
  customSegment?: string;
  sort?: 'recent' | 'spend' | 'visits' | 'name';
  page?: number;
  pageSize?: number;
}
export interface MerchantCustomerList extends Page<MerchantCustomer> {
  customersTotal: number;
  segments: { key: CustomerSegment; count: number }[];
  customSegments: CustomSegment[];
  asOf: string;
}
export interface CustomerExportRow extends MerchantCustomer {
  email: string | null;
  phone: string | null;
  joinedAt: string;
}
export interface MerchantCustomerDetail {
  customer: MerchantCustomer & { phone: string | null };
  asOf: string;
  events: { id: string; type: 'earn' | 'redeem' | 'adjust'; points: number; amount: string | null; branchName: string | null; rewardName: string | null; createdAt: string }[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InsightsKpis {
  sales: string;
  visits: number;
  avgBill: string;
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  /** 0-1 */
  repeatRate: number;
  visitsPerCustomer: number;
  redeemingCustomers: number;
  rewardsRedeemed: number;
  pointsGiven: number;
  pointsRedeemed: number;
}

/** Loyalty performance for a period vs the one before (GET /api/vendor/insights). Counts only. */
export interface Insights {
  range: { from: string; to: string };
  previousRange: { from: string; to: string } | null;
  current: InsightsKpis;
  previous: InsightsKpis | null;
  days: { date: string; sales: string; visits: number; previousSales: string | null; previousVisits: number | null }[];
  /** Merchant admin, all branches only. */
  branches: { id: string; name: string; sales: string; visits: number; customers: number; avgBill: string }[];
  updatedAt: string;
}

/** Per reward: given in the period, customers who can afford it or are close now (GET /api/vendor/reward-performance). Counts only. */
export interface RewardPerformance {
  range: { from: string; to: string };
  /** Balances are merchant-wide: merchant admin only (null for a branch manager). */
  held: {
    points: number;
    customers: number;
    /** points at the active rule (what customers would spend to earn them); null without a rule */
    worth: string | null;
    rate: { spendAmount: string; pointsPerSpend: number } | null;
    readyToRedeem: number;
    closeToReward: number;
  } | null;
  /** Active rewards, plus archived ones given in the period; most given first. */
  rewards: {
    rewardId: string;
    name: string;
    imageUrl: string | null;
    status: 'active' | 'archived';
    pointsCost: number;
    redemptions: number;
    pointsRedeemed: number;
    customers: number;
    /** null for a branch manager */
    canAfford: number | null;
    close: number | null;
  }[];
  updatedAt: string;
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
    throw new ApiError(0, 'network', errorText('network') ?? 'Network error');
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string | string[] };
  if (!res.ok) {
    const code = json.code ?? `http_${res.status}`;
    const server = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new ApiError(res.status, code, errorText(code) ?? server ?? t('common.somethingWrong'));
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
  qrSources: (days: number) => call<QrSources>('GET', `/api/admin/stats/qr-sources?days=${days}`),
  systemDatabase: () => call<SystemDatabase>('GET', '/api/admin/system/database'),
  systemStatus: () => call<SystemStatus>('GET', '/api/admin/system/status'),
  fraudSummary: () => call<FraudSummary>('GET', '/api/admin/fraud/summary'),
  fraudFlags: (q: { status?: FraudStatus; type?: FraudType; page?: number; pageSize?: number }) =>
    call<Page<FraudFlag>>('GET', `/api/admin/fraud/flags${qs(q)}`),
  reviewFraudFlag: (id: string, body: { status: FraudStatus; note?: string }) => call<FraudFlag>('PATCH', `/api/admin/fraud/flags/${id}`, body),
  runFraudCheck: () => call<{ at: string; created: number; byType: Record<FraudType, number> }>('POST', '/api/admin/fraud/check'),

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
  createReward: (vendorId: string, body: RewardBody) => call<Reward>('POST', `/api/admin/vendors/${vendorId}/rewards`, body),
  updateReward: (id: string, body: RewardBody) => call<Reward>('PATCH', `/api/admin/rewards/${id}`, body),
  uploadRewardImage: (id: string, f: File) => call<Reward>('PUT', `/api/admin/rewards/${id}/image`, file(f)),
  removeRewardImage: (id: string) => call<Reward>('DELETE', `/api/admin/rewards/${id}/image`),

  images: (vendorId: string) => call<VendorImage[]>('GET', `/api/admin/vendors/${vendorId}/images`),
  uploadImage: (vendorId: string, f: File, kind: VendorImage['kind'], branchId?: string) =>
    call<VendorImage>('POST', `/api/admin/vendors/${vendorId}/images`, file(f, { kind, branchId })),
  deleteImage: (vendorId: string, imageId: string) => call<void>('DELETE', `/api/admin/vendors/${vendorId}/images/${imageId}`),

  staff: (vendorId: string) => call<Staff[]>('GET', `/api/admin/vendors/${vendorId}/staff`),
  updateStaff: (id: string, body: { name?: string; status?: AccountStatus }) => call<Staff>('PATCH', `/api/admin/staff/${id}`, body),

  merchantFeedback: (q: { mood?: MerchantMood; vendorId?: string; page?: number; pageSize?: number }) =>
    call<Page<MerchantFeedback> & { moods: Record<MerchantMood | 'none', number> }>('GET', `/api/admin/merchant-feedback${qs(q)}`),
  users: (q: { search?: string; status?: UserStatus; page?: number; pageSize?: number }) =>
    call<Page<UserListItem>>('GET', `/api/admin/users${qs(q)}`),
  user: (id: string) => call<UserDetail>('GET', `/api/admin/users/${id}`),
  setUserStatus: (id: string, status: UserStatus) => call<UserDetail>('PATCH', `/api/admin/users/${id}`, { status }),
  userEvents: (id: string, page: number, pageSize = 10) =>
    call<{ items: UserEvent[]; total: number; page: number; pageSize: number }>('GET', `/api/admin/users/${id}/events?page=${page}&pageSize=${pageSize}`),
  /** Add (positive) or take away (negative) points on one card, with a reason. */
  adjustCard: (cardId: string, body: { delta: number; reason: string; idempotencyKey: string }) =>
    call<AdjustResult>('POST', `/api/admin/cards/${cardId}/adjust`, body),
  /** Undo a mistyped collect: takes back exactly the points it gave. */
  reverseEvent: (eventId: string, reason: string) => call<AdjustResult>('POST', `/api/admin/point-events/${eventId}/reverse`, { reason }),
};

/**
 * The signed-in vendor account's own data (/api/vendor). No vendor id is ever sent: the API takes
 * it from the token, so a Starbucks account can only ever reach Starbucks.
 */
export interface CustomerFeedback {
  id: string; name: string; phone: string | null; message: string; createdAt: string;
  branchName: string | null; existingCustomer: boolean;
}
export const vendorApi = {
  customerFeedback: (page = 1) => call<{ items: CustomerFeedback[]; page: number; hasMore: boolean }>('GET', `/api/vendor/customer-feedback?page=${page}`),
  broadcastPreview: (body: MerchantCustomerQuery) => call<{ matched: number; linked: number; unavailable: number; configured: boolean }>('POST', '/api/vendor/broadcasts/preview', body),
  sendBroadcast: (body: MerchantCustomerQuery & { title: string; body: string; idempotencyKey: string }) => call<{ id: string }>('POST', '/api/vendor/broadcasts', body),
  broadcasts: () => call<{ id: string; title: string; body: string; createdAt: string; total: number; pending: number; accepted: number; skipped: number; failed: number; unknown: number }[]>('GET', '/api/vendor/broadcasts'),
  nearbyNotifications: () => call<{ enabled: boolean; locations: number }>('GET', '/api/vendor/broadcasts/nearby'),
  setNearbyNotifications: (enabled: boolean) => call<{ enabled: boolean; locations: number }>('PATCH', '/api/vendor/broadcasts/nearby', { enabled }),
  customers: (q: MerchantCustomerQuery) => call<MerchantCustomerList>('GET', `/api/vendor/customers${qs({ ...q })}`),
  feedback: (body: { mood?: MerchantMood; message: string }) => call<void>('POST', '/api/vendor/feedback', body),
  customersExport: (q: Omit<MerchantCustomerQuery, 'page' | 'pageSize'>) =>
    call<{ items: CustomerExportRow[]; truncated: boolean; asOf: string }>('GET', `/api/vendor/customers/export${qs({ ...q })}`),
  segmentPreview: (body: { match: 'all' | 'any'; rules: SegmentRule[]; branchId?: string }) =>
    call<{ count: number; customersTotal: number }>('POST', '/api/vendor/customer-segments/preview', body),
  createSegment: (body: CustomSegmentInput) => call<CustomSegment>('POST', '/api/vendor/customer-segments', body),
  updateSegment: (id: string, body: Partial<CustomSegmentInput> & { sortOrder?: number }) =>
    call<CustomSegment>('PATCH', `/api/vendor/customer-segments/${encodeURIComponent(id)}`, body),
  archiveSegment: (id: string) => call<void>('DELETE', `/api/vendor/customer-segments/${encodeURIComponent(id)}`),
  addSegmentMember: (id: string, cardId: string) =>
    call<void>('PUT', `/api/vendor/customer-segments/${encodeURIComponent(id)}/members/${encodeURIComponent(cardId)}`),
  removeSegmentMember: (id: string, cardId: string) =>
    call<void>('DELETE', `/api/vendor/customer-segments/${encodeURIComponent(id)}/members/${encodeURIComponent(cardId)}`),
  customer: (id: string, q: { branchId?: string; page?: number; pageSize?: number }) =>
    call<MerchantCustomerDetail>('GET', `/api/vendor/customers/${encodeURIComponent(id)}${qs({ ...q })}`),
  me: () => call<StaffMe>('GET', '/api/vendor/staff/me'),
  summary: (q: { branchId?: string } = {}) => call<VendorSummary>('GET', `/api/vendor/summary${qs({ ...q })}`),
  attention: () => call<{ items: AttentionItem[] }>('GET', '/api/vendor/attention'),
  goLive: () => call<GoLive>('GET', '/api/vendor/go-live'),
  insights: (q: { from: string; to: string; compare?: 'previous' | 'none'; branchId?: string }) =>
    call<Insights>('GET', `/api/vendor/insights${qs({ ...q })}`),
  rewardPerformance: (q: { from: string; to: string; branchId?: string }) =>
    call<RewardPerformance>('GET', `/api/vendor/reward-performance${qs({ ...q })}`),
  redemptions: (q: RedemptionQuery) => call<RedemptionPage>('GET', `/api/vendor/redemptions${qs({ ...q })}`),
  events: (q: ActivityQuery) => call<ActivityPage>('GET', `/api/vendor/events${qs({ ...q })}`),

  usernameAvailability: (username: string) => call<{ available: boolean }>('GET', `/api/vendor/profile/username${qs({ username })}`),
  reserveUsername: (username: string) => call<Vendor>('PUT', '/api/vendor/profile/username', { username }),
  profile: () => call<Vendor>('GET', '/api/vendor/profile'),
  storefront: () => call<StorefrontSettings>('GET', '/api/vendor/storefront'),
  saveStorefront: (body: { branchId?: string; storefront: Storefront | null }) => call<StorefrontSettings>('PUT', '/api/vendor/storefront', body),
  updateProfile: (
    body: { name?: string; contactEmail?: string | null; contactPhone?: string | null } & Partial<VendorBranding> &
      Partial<Pick<Vendor, 'pageStyle' | 'brandPrimary' | 'brandSecondary' | 'brandFont'>>,
  ) =>
    call<Vendor>('PATCH', '/api/vendor/profile', body),
  uploadLogo: (f: File) => call<Vendor>('PUT', '/api/vendor/profile/logo', file(f)),
  removeLogo: () => call<Vendor>('DELETE', '/api/vendor/profile/logo'),
  uploadBanner: (f: File) => call<Vendor>('PUT', '/api/vendor/profile/banner', file(f)),
  removeBanner: () => call<Vendor>('DELETE', '/api/vendor/profile/banner'),

  branches: () => call<Branch[]>('GET', '/api/vendor/branches'),
  createBranch: (body: Partial<Branch>) => call<Branch>('POST', '/api/vendor/branches', body),
  updateBranch: (id: string, body: Partial<Branch>) => call<Branch>('PATCH', `/api/vendor/branches/${id}`, body),
  pauseBranch: (id: string, until: string) => call<Branch>('PUT', `/api/vendor/branches/${id}/pause`, { until }),
  resumeBranch: (id: string) => call<Branch>('DELETE', `/api/vendor/branches/${id}/pause`),

  pointRules: () => call<PointRule[]>('GET', '/api/vendor/point-rules'),
  publishRule: (body: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null }) =>
    call<PointRule>('POST', '/api/vendor/point-rules', body),
  deactivateRule: () => call<void>('DELETE', '/api/vendor/point-rules/active'),

  rewards: () => call<Reward[]>('GET', '/api/vendor/rewards'),
  createReward: (body: RewardBody) => call<Reward>('POST', '/api/vendor/rewards', body),
  updateReward: (id: string, body: RewardBody) => call<Reward>('PATCH', `/api/vendor/rewards/${id}`, body),
  uploadRewardImage: (id: string, f: File) => call<Reward>('PUT', `/api/vendor/rewards/${id}/image`, file(f)),
  removeRewardImage: (id: string) => call<Reward>('DELETE', `/api/vendor/rewards/${id}/image`),
  soldOuts: () => call<SoldOut[]>('GET', '/api/vendor/rewards/sold-out'),
  /** branchId omitted (vendor admin) = every open branch; until null = until turned back on. */
  setSoldOut: (rewardId: string, body: { branchId?: string; until: string | null }) =>
    call<SoldOut[]>('PUT', `/api/vendor/rewards/${rewardId}/sold-out`, body),
  clearSoldOut: (rewardId: string, branchId?: string) =>
    call<SoldOut[]>('DELETE', `/api/vendor/rewards/${rewardId}/sold-out${qs({ branchId })}`),

  images: () => call<VendorImage[]>('GET', '/api/vendor/images'),
  uploadImage: (f: File, kind: VendorImage['kind'], branchId?: string) =>
    call<VendorImage>('POST', '/api/vendor/images', file(f, { kind, branchId })),
  deleteImage: (id: string) => call<void>('DELETE', `/api/vendor/images/${id}`),

  /** The till: the same scan calls as the staff app. */
  scanPreview: (code: string) => call<ScanPreview>('POST', '/api/vendor/scans/preview', { code }),
  collect: (body: { code: string; amount: number; branchId?: string; idempotencyKey: string }) =>
    call<CollectResult>('POST', '/api/vendor/scans/collect', body),
  redeem: (body: { code: string; branchId?: string; idempotencyKey: string }) => call<RedeemResult>('POST', '/api/vendor/scans/redeem', body),
  patterns: (q: { branchId?: string }) => call<VendorPatterns>('GET', `/api/vendor/insights/patterns${qs({ ...q })}`),
  scansToday: () => call<{ collects: number; redemptions: number }>('GET', '/api/vendor/scans/today'),

  staff: () => call<Staff[]>('GET', '/api/vendor/staff'),
  inviteStaff: (body: { name: string; email: string; role: StaffRole; branchId?: string }) =>
    call<Staff & { invited: boolean }>('POST', '/api/vendor/staff', body),
  updateStaff: (id: string, body: { name?: string; status?: AccountStatus }) => call<Staff>('PATCH', `/api/vendor/staff/${id}`, body),
};

/** A readable message for any error thrown by an API call or Supabase. */
export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
