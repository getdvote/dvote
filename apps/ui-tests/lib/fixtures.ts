/**
 * Mock API data, typed against the apps' own API types so a changed shape fails `npm run typecheck`
 * instead of silently showing empty pages. Names are deliberately long and mixed EN/AR, and numbers
 * large, so layouts are tested with realistic worst cases.
 */
import type {
  CardMemberPage,
  ActivityPage,
  AdminMe,
  AttentionItem,
  Branch,
  CustomSegment,
  CustomerFeedback,
  FraudFlag,
  FraudSummary,
  GoLive,
  Insights,
  MerchantCustomerDetail,
  MerchantCustomerList,
  MerchantFeedback,
  Overview,
  Page,
  PointRule,
  QrSources,
  RedemptionPage,
  Reward,
  RewardPerformance,
  SoldOut,
  Staff,
  StaffMe,
  StorefrontSettings,
  SystemDatabase,
  SystemStatus,
  UserDetail,
  UserListItem,
  Vendor,
  VendorImage,
  VendorPatterns,
  VendorSummary,
  LoyaltyCardInfo,
} from '../../dashboard/src/lib/api';
import type { PublicCard, PublicVendor } from '../../web/src/lib/api';

const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo = 0, hour = 12) => new Date(now - daysAgo * DAY + (hour - 12) * 3_600_000).toISOString();
const day = (daysAgo = 0) => iso(daysAgo).slice(0, 10);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// a 1×1 grey PNG for every image
export const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export const VENDOR_ID = '11111111-0000-4000-8000-000000000001';
const BRANCH_IDS = ['22222222-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000003'];
const STAFF_ID = '33333333-0000-4000-8000-000000000001';

export const vendor: Vendor = {
  id: VENDOR_ID,
  name: 'Joy Corner Specialty Coffee & Bakery',
  logoUrl: PIXEL,
  slug: 'joy-corner',
  bannerUrl: null,
  category: 'cafe_restaurant',
  cardDesign: 3,
  contactEmail: 'hello.team@joycornerspecialtycoffee.com',
  contactPhone: '+201001234567',
  pageStyle: 'spotlight',
  brandPrimary: '#C0050F',
  brandSecondary: null,
  brandFont: 'inter',
  currency: 'EGP',
  status: 'active',
  branchCount: 3,
  staffCount: 7,
  createdAt: iso(120),
  updatedAt: iso(1),
};

const branchNames = ['Smouha – Victor Emmanuel Square (main)', 'Gleem Bay', 'San Stefano Mall, Level 2'];
export const branches: Branch[] = branchNames.map((name, i) => ({
  id: BRANCH_IDS[i],
  vendorId: VENDOR_ID,
  name,
  address: i === 0 ? '24 Victor Emmanuel Square, next to the Smouha Club gate, Alexandria' : 'Corniche Road, Alexandria',
  city: 'alexandria',
  lat: 31.2 + i / 100,
  lng: 29.9 + i / 100,
  timezone: 'Africa/Cairo',
  opensAt: '08:00',
  closesAt: '23:30',
  hours: range(7).map((d) => ({ day: d, opensAt: '08:00', closesAt: '23:30' })),
  pausedUntil: null,
  status: i === 2 ? 'closed' : 'active',
  createdAt: iso(100 - i),
}));

export const staffMe = (role: StaffMe['role'] = 'vendor_admin'): StaffMe => ({
  id: STAFF_ID,
  vendorId: VENDOR_ID,
  branchId: role === 'branch_manager' || role === 'staff' ? BRANCH_IDS[0] : null,
  name: 'Mohamed Abdelrahman El-Sayed',
  email: 'mohamed.abdelrahman@joycornerspecialtycoffee.com',
  role,
  status: 'active',
  createdAt: iso(120),
  updatedAt: iso(1),
  vendor: { id: VENDOR_ID, name: vendor.name, logoUrl: PIXEL, currency: 'EGP' },
  branch: role === 'branch_manager' || role === 'staff' ? { id: BRANCH_IDS[0], name: branchNames[0] } : null,
  branches: branches.filter((b) => b.status === 'active').map((b) => ({ id: b.id, name: b.name })),
  activeRule: { version: 3, spendAmount: '10.00', pointsPerSpend: 1, minPurchase: '0.00', maxPointsPerPurchase: 500 },
});

export const staff: Staff[] = [
  ['Mohamed Abdelrahman El-Sayed', 'vendor_admin', null],
  ['Sara Mahmoud', 'branch_manager', BRANCH_IDS[0]],
  ['Omar Khaled Mostafa Ibrahim', 'staff', BRANCH_IDS[0]],
  ['منى عادل', 'staff', BRANCH_IDS[1]],
  ['Youssef', 'viewer', null],
].map(([name, role, branchId], i) => ({
  id: `33333333-0000-4000-8000-00000000000${i + 1}`,
  vendorId: VENDOR_ID,
  branchId,
  name: name as string,
  email: `${(name as string).toLowerCase().replace(/[^a-z]+/g, '.') || 'mona'}@joycorner.test`,
  role: role as Staff['role'],
  status: i === 4 ? 'disabled' : 'active',
  createdAt: iso(90 - i),
  updatedAt: iso(2),
}));

export const pointRules: PointRule[] = [
  { id: 'r3', version: 3, spendAmount: '10.00', pointsPerSpend: 1, minPurchase: '0.00', maxPointsPerPurchase: 500, isActive: true, createdAt: iso(20) },
  { id: 'r2', version: 2, spendAmount: '20.00', pointsPerSpend: 1, minPurchase: '50.00', maxPointsPerPurchase: null, isActive: false, createdAt: iso(60) },
];

const rewardRows: [string, string | null, string | null, number][] = [
  ['Free coffee', 'قهوة مجانية', 'Any coffee, any size, hot or iced', 300],
  ['Free cheesecake slice with seasonal berry topping', 'تشيز كيك مجاني', 'One slice of cheesecake', 500],
  ['Free coffee + cheesecake', null, null, 750],
  ['Breakfast for two', 'فطار لشخصين', 'Two breakfast plates and two hot drinks of your choice', 2500],
];
export const rewards: Reward[] = rewardRows.map(([name, nameAr, description, pointsCost], i) => ({
  id: `44444444-0000-4000-8000-00000000000${i + 1}`,
  vendorId: VENDOR_ID,
  name,
  nameAr,
  description,
  descriptionAr: nameAr ? 'أي قهوة، أي حجم' : null,
  imageUrl: i === 0 ? PIXEL : null,
  pointsCost,
  retailValue: i === 0 ? '85.00' : null,
  status: i === 3 ? 'archived' : 'active',
  sortOrder: i + 1,
  createdAt: iso(80 - i),
}));

export const soldOuts: SoldOut[] = [{ rewardId: rewards[1].id, branchId: BRANCH_IDS[1], branchName: branchNames[1], until: null }];

export const images: VendorImage[] = [
  { id: 'i1', kind: 'menu', branchId: null, url: PIXEL, sortOrder: 1, createdAt: iso(10) },
  { id: 'i2', kind: 'menu', branchId: null, url: PIXEL, sortOrder: 2, createdAt: iso(10) },
  { id: 'i3', kind: 'branch_photo', branchId: BRANCH_IDS[0], url: PIXEL, sortOrder: 1, createdAt: iso(10) },
];

export const summary: VendorSummary = {
  collectsToday: 128,
  pointsToday: 4_215,
  customers: 12_480,
  newCustomers7d: 316,
  pointsEarned30d: 184_250,
  pointsRedeemed30d: 61_300,
  pointsOutstanding: 1_204_880,
  days: range(14).map((i) => ({ date: day(13 - i), pointsEarned: 3000 + ((i * 937) % 4000), collects: 80 + ((i * 53) % 90) })),
  branches: branches.slice(0, 2).map((b, i) => ({ id: b.id, name: b.name, collects: 900 - i * 300, pointsEarned: 92_000 - i * 30_000 })),
};

export const attention: { items: AttentionItem[] } = {
  items: [
    { key: 'sold_out', group: 'now', tone: 'warning', title: 'Rewards sold out', detail: 'Free cheesecake slice is sold out at Gleem Bay', action: { label: 'Open rewards', to: '/rewards' }, params: { count: 1, branch: 'Gleem Bay' } },
    { key: 'no_arabic', group: 'setup', tone: 'info', title: 'Rewards without an Arabic name', detail: '1 reward', action: { label: 'Add names', to: '/rewards' }, params: { count: 1 } },
  ],
};

export const goLive: GoLive = {
  steps: [
    { key: 'logo', done: true, to: '/settings?tab=branding' },
    { key: 'rule', done: true, to: '/card' },
    { key: 'reward', done: false, to: '/rewards' },
    { key: 'branch_hours', done: true, to: '/branches' },
    { key: 'staff', done: true, to: '/settings?tab=team' },
    { key: 'test_scan', done: false, to: '/scan' },
  ],
  done: 4,
  total: 6,
  live: false,
  rewards: { active: 3, withPhoto: 1, withArabic: 2 },
  firstScanAt: null,
};

const customerNames = ['Ahmed Mohamed Abdelaziz Elshenawy', 'سارة محمود', null, 'Karim', 'Nour El-Din Hassan', 'Laila Ibrahim', 'Mostafa', 'مريم أحمد'];
const segs = ['champions', 'regulars', 'new', 'never_visited', 'slipping', 'at_risk', 'lost', 'regulars'] as const;
export const customSegments: CustomSegment[] = [
  { id: 'cs1', name: 'Weekend breakfast regulars from Smouha', description: 'Visit on Fridays and Saturdays before noon', match: 'all', rules: [{ field: 'visits_30d', op: 'gte', value: 4 }], sortOrder: 1, count: 412 },
  { id: 'cs2', name: 'VIP', description: null, match: 'any', rules: [], sortOrder: 2, count: 18 },
];
export const customers: MerchantCustomerList = {
  items: customerNames.map((name, i) => ({
    id: `55555555-0000-4000-8000-00000000000${i + 1}`,
    reference: `CZW-QN${i}`,
    name,
    segment: segs[i],
    customSegment: i === 0 ? { id: 'cs1', name: customSegments[0].name, manual: false } : null,
    firstVisitAt: i === 3 ? null : iso(200 - i * 10),
    lastVisitAt: i === 3 ? null : iso(i * 7),
    visits: i === 3 ? 0 : 120 - i * 13,
    visits90d: i === 3 ? 0 : 24 - i * 2,
    spend: (48_250.5 - i * 4000).toFixed(2),
    averageBill: '402.10',
    rewardsRedeemed: 12 - i,
    pointsBalance: 4_820 - i * 300,
  })),
  total: 12_480,
  page: 1,
  pageSize: 20,
  customersTotal: 12_480,
  segments: (['champions', 'regulars', 'new', 'never_visited', 'slipping', 'at_risk', 'lost'] as const).map((key, i) => ({ key, count: [812, 3204, 316, 1220, 2100, 940, 3888][i] })),
  customSegments,
  asOf: iso(),
};

export const customerDetail: MerchantCustomerDetail = {
  customer: { ...customers.items[0], phone: '+201001234567' },
  asOf: iso(),
  events: range(10).map((i) => ({
    id: `ev${i}`,
    type: i % 4 === 3 ? 'redeem' : 'earn',
    points: i % 4 === 3 ? -300 : 42,
    amount: i % 4 === 3 ? null : '425.50',
    branchName: branchNames[i % 2],
    rewardName: i % 4 === 3 ? rewards[0].name : null,
    createdAt: iso(i * 3),
  })),
  total: 140,
  page: 1,
  pageSize: 10,
};

export const activity: ActivityPage = {
  items: range(20).map((i) => ({
    id: `ac${i}`,
    type: i % 5 === 4 ? 'redeem' : i === 7 ? 'adjust' : 'earn',
    points: i % 5 === 4 ? -500 : 38 + i,
    amount: i % 5 === 4 ? null : (380 + i * 11.5).toFixed(2),
    receiptRef: i % 3 ? `INV-2026-00${4810 + i}` : null,
    branch: { id: BRANCH_IDS[i % 2], name: branchNames[i % 2] },
    staff: { id: staff[i % 3].id, name: staff[i % 3].name },
    reward: i % 5 === 4 ? { id: rewards[1].id, name: rewards[1].name } : null,
    reason: i === 7 ? 'Points missing from a receipt the customer paid in cash on Friday' : null,
    customerRef: `9f3a1${i}`,
    createdAt: iso(i / 4, 9 + (i % 10)),
  })),
  total: 4_812,
  page: 1,
  pageSize: 20,
  totals: { collects: 4_120, redemptions: 692, pointsEarned: 184_250, pointsRedeemed: 61_300, sales: '1842500.75' },
};

export const redemptions: RedemptionPage = {
  items: range(12).map((i) => ({
    id: `rd${i}`,
    rewardId: rewards[i % 3].id,
    rewardName: rewards[i % 3].name,
    imageUrl: rewards[i % 3].imageUrl,
    pointsCost: rewards[i % 3].pointsCost,
    branch: { id: BRANCH_IDS[i % 2], name: branchNames[i % 2] },
    staff: { id: staff[i % 3].id, name: staff[i % 3].name },
    customerRef: `7c2e${i}`,
    createdAt: iso(i / 2),
  })),
  total: 692,
  page: 1,
  pageSize: 20,
  totals: { redemptions: 692, points: 248_500, customers: 401 },
  byReward: rewards.slice(0, 3).map((r, i) => ({ rewardId: r.id, name: r.name, imageUrl: r.imageUrl, status: r.status, count: 400 - i * 120, points: (400 - i * 120) * r.pointsCost })),
};

const kpis = (k: number) => ({
  sales: (1_842_500.75 * k).toFixed(2),
  visits: Math.round(4120 * k),
  avgBill: '447.20',
  customers: Math.round(2210 * k),
  newCustomers: Math.round(316 * k),
  returningCustomers: Math.round(1400 * k),
  repeatRate: 0.634,
  visitsPerCustomer: 1.86,
  redeemingCustomers: Math.round(401 * k),
  rewardsRedeemed: Math.round(692 * k),
  pointsGiven: Math.round(184_250 * k),
  pointsRedeemed: Math.round(61_300 * k),
});
export const insights: Insights = {
  range: { from: day(6), to: day(0) },
  previousRange: { from: day(13), to: day(7) },
  current: kpis(1),
  previous: kpis(0.87),
  days: range(7).map((i) => ({ date: day(6 - i), sales: (250_000 + i * 9000).toFixed(2), visits: 560 + i * 12, previousSales: (230_000 + i * 7000).toFixed(2), previousVisits: 520 + i * 9 })),
  branches: branches.slice(0, 2).map((b, i) => ({ id: b.id, name: b.name, sales: (1_200_000 - i * 550_000).toFixed(2), visits: 2700 - i * 1200, customers: 1500 - i * 700, avgBill: '447.20' })),
  updatedAt: iso(),
};

export const rewardPerformance: RewardPerformance = {
  range: { from: day(6), to: day(0) },
  held: { points: 1_204_880, customers: 9_420, worth: '12048800.00', rate: { spendAmount: '10.00', pointsPerSpend: 1 }, readyToRedeem: 2_104, closeToReward: 880 },
  rewards: rewards.map((r, i) => ({
    rewardId: r.id,
    name: r.name,
    imageUrl: r.imageUrl,
    status: r.status,
    pointsCost: r.pointsCost,
    redemptions: 400 - i * 100,
    pointsRedeemed: (400 - i * 100) * r.pointsCost,
    customers: 300 - i * 70,
    canAfford: 2104 - i * 500,
    close: 880 - i * 200,
  })),
  updatedAt: iso(),
};

export const patterns: VendorPatterns = {
  topMembers: customers.items.slice(0, 5).map((c) => ({ customerRef: c.reference, name: c.name, visits: c.visits, points: 4800, rewards: c.rewardsRedeemed, spent: c.spend, lastSeen: c.lastVisitAt ?? iso() })),
  busiestHours: range(7).flatMap((d) => range(14).map((h) => ({ day: d, hour: h + 8, count: ((d + 3) * (h + 5)) % 40 }))),
  cohorts: range(6).map((i) => ({ month: day(30 * (5 - i)).slice(0, 7), size: 300 + i * 40, returned: range(5 - i).map((k) => 0.6 - k * 0.08) })),
  updatedAt: iso(),
};

export const loyaltyCard: LoyaltyCardInfo = {
  card: {
    id: 'card-program-1',
    name: 'Joy Corner Rewards',
    status: 'active',
    cancelledAt: null,
    restorableUntil: null,
    liveVersionId: 'version-3',
    createdAt: '2026-10-16T10:00:00.000Z',
  },
  design: {
    colors: { background: '#2048AC', text: '#FFFFFF', label: '#D4D4D8', useBrand: true, autoText: true, autoLabel: true },
    background: { style: 'mesh', imageUrl: null, imagePath: null },
    front: { title: { en: 'Joy Corner Rewards', ar: 'مكافآت جوي كورنر' }, pointsLabel: { en: 'Points', ar: 'النقاط' } },
    buttons: { primaryLabel: { en: 'Offers & Rewards', ar: 'العروض والمكافآت' }, secondary: { type: 'directions', branchId: BRANCH_IDS[0] } },
    back: {
      about: 'Earn points on everything you spend. Show this card at the till and watch your balance grow toward your next reward.',
      hours: [0, 1, 2, 3, 4, 6].map((day) => ({ day, opensAt: '08:00', closesAt: '23:00' })),
      links: [
        { platform: 'instagram', value: '@joycorner' },
        { platform: 'whatsapp', value: '+20 100 123 4567' },
        { platform: 'custom', value: 'https://joycorner.cafe/menu', label: 'Full menu & seasonal specials' },
      ],
      terms: 'One reward per visit. Rewards can’t be exchanged for cash.',
    },
  },
  versions: [3, 2, 1].map((n) => ({
    id: `version-${n}`,
    number: n,
    createdAt: `2026-10-1${n + 5}T12:0${n}:00.000Z`,
    createdBy: 'Mohamed Marrouf',
    live: n === 3,
  })),
  counts: { members: 12_480, active30d: 3_904 },
  rule: { spendAmount: '10.00', pointsPerSpend: 1 },
  canCreate: false,
};


export const storefront: StorefrontSettings = {
  shop: {
    sections: [
      { type: 'loyalty', label: 'loyalty_card' },
      { type: 'rewards' },
      { type: 'menu' },
      { type: 'branches' },
      { type: 'wifi', ssid: 'JoyCorner-Guests-5G', security: 'wpa', password: 'coffee-lovers-2026' },
      { type: 'feedback' },
    ],
  },
  branches: branches.slice(0, 2).map((b, i) => ({ id: b.id, name: b.name, storefront: i === 1 ? { sections: [{ type: 'loyalty', label: 'join_club' }] } : null })),
};

export const customerFeedback: { items: CustomerFeedback[]; page: number; hasMore: boolean } = {
  items: range(6).map((i) => ({
    id: `cf${i}`,
    name: customerNames[i] ?? 'Guest',
    phone: i % 2 ? '+201001234567' : null,
    message:
      i === 0
        ? 'The new seasonal menu is lovely, but the music on Friday evenings was far too loud to talk with friends. Could you keep it lower after 8 pm? Otherwise everything was perfect, thank you!'
        : 'Great coffee and friendly staff.',
    createdAt: iso(i),
    branchName: branchNames[i % 2],
    existingCustomer: i % 2 === 0,
  })),
  page: 1,
  hasMore: true,
};

export const broadcasts = range(3).map((i) => ({
  id: `bc${i}`,
  title: i === 0 ? 'Double points on every iced drink this weekend only' : 'New breakfast menu',
  body: 'Come try our new breakfast plates, served every day from 8 am until noon at all branches.',
  createdAt: iso(i * 5),
  total: 4_200,
  pending: i === 0 ? 120 : 0,
  accepted: 3_900,
  skipped: 100,
  failed: 80,
  unknown: 0,
}));

// ── admin ─────────────────────────────────────────────────────────────

export const adminMe: AdminMe = { id: 'admin-1', name: 'Karim Desouki', email: 'karim@dvote.app' };

export const overview: Overview = {
  vendorsActive: 42,
  vendorsSuspended: 3,
  branchesOpen: 118,
  customers: 248_120,
  customersBlocked: 14,
  customersNew7d: 3_204,
  cards: 512_440,
  pointsEarned: 48_220_100,
  pointsRedeemed: 12_004_300,
  pointsOutstanding: 36_215_800,
  collectsToday: 4_812,
  days: range(14).map((i) => ({ date: day(13 - i), pointsEarned: 300_000 + i * 9000, collects: 4000 + i * 80, newCustomers: 200 + i * 9 })),
  topVendors: range(5).map((i) => ({ id: `v${i}`, name: i === 0 ? vendor.name : `Coffee Lab ${i}`, logoUrl: PIXEL, pointsEarned: 900_000 - i * 100_000, collects: 20_000 - i * 3000 })),
};

export const vendors: Vendor[] = range(8).map((i) =>
  i === 0 ? vendor : { ...vendor, id: `v${i}`, name: ['Ecuador Coffee', 'Costa Coffee', 'Starbucks Reserve – City Stars', 'Marrouf Coffee', 'Brew & Bake', 'Cilantro', 'Beanos'][i - 1], slug: `shop-${i}`, status: i === 6 ? 'suspended' : 'active' },
);

export const users: Page<UserListItem> = {
  items: range(10).map((i) => ({
    id: `u${i}`,
    name: i === 2 ? null : (customerNames[i % customerNames.length] ?? 'Guest'),
    email: i % 3 ? `customer.number.${i}@gmail.com` : null,
    phone: '+201001234567',
    status: i === 5 ? 'blocked' : 'active',
    avatarUrl: null,
    cardsCount: 1 + (i % 4),
    pointsBalance: 12_400 - i * 900,
    lastActivityAt: iso(i),
    createdAt: iso(100 + i),
  })),
  total: 248_120,
  page: 1,
  pageSize: 20,
};

export const userDetail: UserDetail = {
  ...users.items[0],
  gender: 'male',
  birthDate: '1994-05-12',
  cards: range(3).map((i) => ({ id: `card${i}`, vendorId: vendors[i].id, vendorName: vendors[i].name, vendorLogoUrl: PIXEL, balance: 4800 - i * 1000, lifetimePoints: 12000, lastActivityAt: iso(i) })),
  events: range(10).map((i) => ({
    id: `ue${i}`,
    cardId: 'card0',
    reversed: i === 2,
    adminName: i === 5 ? 'Karim Desouki' : null,
    type: i === 5 ? 'adjust' : i % 4 === 3 ? 'redeem' : 'earn',
    delta: i % 4 === 3 ? -300 : 42,
    vendorName: vendor.name,
    branchName: branchNames[0],
    purchaseAmount: '425.50',
    rewardName: i % 4 === 3 ? rewards[0].name : null,
    reason: i === 5 ? 'Missing points from a cash receipt' : null,
    createdAt: iso(i),
  })),
};

export const qrSources: QrSources = {
  days: 30,
  master: { collects: 82_400, points: 3_120_000 },
  shop: { collects: 41_200, points: 1_540_000 },
  daily: range(30).map((i) => ({ date: day(29 - i), master: 2600 + i * 10, shop: 1300 + i * 7 })),
  vendors: vendors.slice(0, 6).map((v, i) => ({ id: v.id, name: v.name, logoUrl: PIXEL, master: 20_000 - i * 2500, shop: 9_000 - i * 1000 })),
};

export const systemDatabase: SystemDatabase = {
  sizeBytes: 412_000_000,
  version: 'PostgreSQL 17.4 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit',
  connections: 14,
  maxConnections: 60,
  cacheHitPercent: 99.4,
  authUsers: 248_400,
  tables: ['point_events', 'cards', 'users', 'qr_codes', 'redemptions', 'customer_segment_members'].map((name, i) => ({ name, rows: 4_000_000 / (i + 1), sizeBytes: 90_000_000 / (i + 1) })),
  storage: [
    { bucket: 'vendors', files: 1_204, sizeBytes: 820_000_000 },
    { bucket: 'avatars', files: 9_120, sizeBytes: 410_000_000 },
  ],
  server: { memoryTotalBytes: 1e9, memoryAvailableBytes: 4e8, diskTotalBytes: 8e9, diskAvailableBytes: 5e9, load1: 0.42, load5: 0.38, load15: 0.3, cpus: 2 },
  checkedAt: iso(),
};

export const systemStatus: SystemStatus = {
  checks: [
    { name: 'API', kind: 'api', up: true, latencyMs: 4, detail: 'Up 3 days, 212 MB RAM, 18 live apps' },
    { name: 'Database', kind: 'database', up: true, latencyMs: 31, detail: 'SELECT 1' },
    { name: 'Supabase Auth', kind: 'auth', up: true, latencyMs: 120, detail: 'healthy' },
    { name: 'Storage', kind: 'storage', up: false, latencyMs: 5000, detail: 'Timed out after 5 s while connecting to the storage endpoint' },
    { name: 'Customer website', kind: 'website', up: true, latencyMs: 88, detail: '200 OK', url: 'https://dvote.app/joy-corner' },
  ],
  checkedAt: iso(),
};

export const fraudSummary: FraudSummary = {
  open: 7,
  openByType: { too_many_collects: 3, large_purchase: 2, branch_spike: 1, staff_spike: 1 },
  confirmed: 12,
  dismissed: 40,
  last7d: 9,
  lastCheckAt: iso(),
  rules: { maxCollectsPerDay: 3, largePurchaseMultiple: 5 },
};

export const fraudFlags: Page<FraudFlag> = {
  items: range(5).map((i) => ({
    id: `ff${i}`,
    type: (['too_many_collects', 'large_purchase', 'branch_spike', 'staff_spike', 'too_many_collects'] as const)[i],
    status: i === 4 ? 'confirmed' : 'open',
    vendor: { id: VENDOR_ID, name: vendor.name },
    branch: { id: BRANCH_IDS[0], name: branchNames[0] },
    user: i % 2 ? null : { id: 'u0', name: customerNames[0] ?? '', email: 'customer@gmail.com', status: 'active' },
    staff: i === 3 ? { id: STAFF_ID, name: staff[2].name } : null,
    details: { day: day(i), collects: 6, amount: '4250.00' },
    reviewedBy: i === 4 ? { id: 'admin-1', name: 'Karim Desouki' } : null,
    createdAt: iso(i),
    updatedAt: iso(i),
  })),
  total: 52,
  page: 1,
  pageSize: 20,
};

export const merchantFeedback: Page<MerchantFeedback> & { moods: Record<'love' | 'okay' | 'unhappy' | 'none', number> } = {
  items: range(4).map((i) => ({
    id: `mf${i}`,
    createdAt: iso(i),
    mood: (['love', 'unhappy', 'okay', null] as const)[i],
    message: i === 1 ? 'Scanning at the till was slow during the morning rush. The camera took a long time to focus on the customer QR codes, so we had to type them by hand.' : 'Love the new storefront editor!',
    vendor: { id: vendors[i].id, name: vendors[i].name, logoUrl: PIXEL },
    staff: { name: staff[i].name, email: staff[i].email, role: staff[i].role },
  })),
  total: 4,
  page: 1,
  pageSize: 20,
  moods: { love: 1, okay: 1, unhappy: 1, none: 1 },
};

// ── customer website ──────────────────────────────────────────────────

const CARD_LOOK = { status: 'active' as const, title: { en: 'Joy Corner Rewards', ar: 'مكافآت جوي كورنر' }, pointsLabel: { en: 'Points', ar: 'النقاط' }, colors: { background: '#2048AC', text: '#FFFFFF', label: '#D4D4D8' }, background: { style: 'mesh' as const, imageUrl: null } };

export const publicVendor: PublicVendor = {
  id: VENDOR_ID,
  slug: 'joy-corner',
  name: vendor.name,
  logoUrl: PIXEL,
  bannerUrl: null,
  category: 'cafe_restaurant',
  cardDesign: 3,
  card: CARD_LOOK,
  currency: 'EGP',
  rule: { spendAmount: '10.00', pointsPerSpend: 1 },
  rewards: rewards.filter((r) => r.status === 'active').map((r) => ({ name: r.name, nameAr: r.nameAr, pointsCost: r.pointsCost, imageUrl: r.imageUrl })),
  branches: branches.slice(0, 2).map((b) => ({ id: b.id, name: b.name, address: b.address, mapsUrl: 'https://maps.google.com/?q=31.2,29.9' })),
  style: { pageStyle: 'spotlight', primary: '#C0050F', secondary: null, font: 'Inter' },
  sections: storefront.shop.sections,
  menu: [PIXEL, PIXEL],
};

export const publicCard: PublicCard = {
  publicId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  shortCode: 'CZW-QNM',
  cardholder: 'Ahmed Mohamed Abdelaziz Elshenawy',
  balance: 12_480,
  vendor: { id: VENDOR_ID, slug: 'joy-corner', name: vendor.name, logoUrl: PIXEL, bannerUrl: null, cardDesign: 3, card: CARD_LOOK, currency: 'EGP' },
  createdAt: iso(30),
};

export const cardMembers: CardMemberPage = {
  total: 7,
  page: 1,
  pageSize: 25,
  items: [
    { id: 'm1', name: 'Lucia Garcia', email: null, phone: '+201001234567', code: 'K7M-4QX', joinedAt: '2026-10-19T18:20:00Z', points: 120 },
    { id: 'm2', name: 'Omar Hassan', email: null, phone: '+201112223334', code: 'P3R-9TW', joinedAt: '2026-10-18T10:05:00Z', points: 45 },
    { id: 'm3', name: 'نور أحمد', email: null, phone: '+201223334445', code: 'H2C-7LN', joinedAt: '2026-10-17T12:40:00Z', points: 300 },
    { id: 'm4', name: 'Sara Ali', email: null, phone: null, code: 'Z8D-2QF', joinedAt: '2026-10-15T09:12:00Z', points: 0 },
    { id: 'm5', name: 'Youssef Tarek', email: null, phone: null, code: 'B5V-6KM', joinedAt: '2026-10-12T16:30:00Z', points: 860 },
  ],
};
