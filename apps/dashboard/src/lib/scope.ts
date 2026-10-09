import { api, vendorApi, type AccountStatus, type Branch, type PointRule, type Reward, type Staff, type StaffMe, type StaffRole, type VendorImage } from './api';

type RuleBody = { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null };

/**
 * One vendor's data, as the shared tabs (branches, rule, rewards, images, staff) see it.
 * A platform admin gets `adminScope(id)` (any vendor); a vendor account gets `myVendorScope(me)`,
 * which only calls /api/vendor — the vendor comes from the token, never from the page.
 */
export interface VendorScope {
  /** Query-key part: the vendor id, or 'me'. */
  key: string;
  currency: string;
  can: {
    editVendor: boolean; // branches, rule, rewards, menu
    branchPhotos: (branchId: string) => boolean;
    manageStaff: boolean;
    /** Roles this account may invite (empty = no invite button). */
    inviteRoles: StaffRole[];
    /** Branch new branch-level staff go to when the account can't choose (branch managers). */
    fixedBranchId: string | null;
  };
  branches: () => Promise<Branch[]>;
  createBranch: (body: Partial<Branch>) => Promise<Branch>;
  updateBranch: (id: string, body: Partial<Branch>) => Promise<Branch>;
  pointRules: () => Promise<PointRule[]>;
  publishRule: (body: RuleBody) => Promise<PointRule>;
  deactivateRule: () => Promise<void>;
  rewards: () => Promise<Reward[]>;
  createReward: (body: Partial<Reward>) => Promise<Reward>;
  updateReward: (id: string, body: Partial<Reward>) => Promise<Reward>;
  images: () => Promise<VendorImage[]>;
  uploadImage: (f: File, kind: VendorImage['kind'], branchId?: string) => Promise<VendorImage>;
  deleteImage: (id: string) => Promise<void>;
  staff: () => Promise<Staff[]>;
  updateStaff: (id: string, body: { name?: string; status?: AccountStatus }) => Promise<Staff>;
  inviteStaff: (body: { name: string; email: string; role: StaffRole; branchId?: string }) => Promise<Staff & { invited: boolean }>;
}

export function adminScope(vendorId: string, currency: string): VendorScope {
  return {
    key: vendorId,
    currency,
    can: { editVendor: true, branchPhotos: () => true, manageStaff: true, inviteRoles: ['vendor_admin'], fixedBranchId: null },
    branches: () => api.branches(vendorId),
    createBranch: (b) => api.createBranch(vendorId, b),
    updateBranch: api.updateBranch,
    pointRules: () => api.pointRules(vendorId),
    publishRule: (b) => api.publishRule(vendorId, b),
    deactivateRule: () => api.deactivateRule(vendorId),
    rewards: () => api.rewards(vendorId),
    createReward: (b) => api.createReward(vendorId, b),
    updateReward: api.updateReward,
    images: () => api.images(vendorId),
    uploadImage: (f, kind, branchId) => api.uploadImage(vendorId, f, kind, branchId),
    deleteImage: (id) => api.deleteImage(vendorId, id),
    staff: () => api.staff(vendorId),
    updateStaff: api.updateStaff,
    inviteStaff: (b) => api.inviteVendorAdmin(vendorId, { name: b.name, email: b.email }),
  };
}

/** What the signed-in vendor account may do; the API enforces the same rules. */
export function myVendorScope(me: StaffMe): VendorScope {
  const isAdmin = me.role === 'vendor_admin';
  return {
    key: 'me',
    currency: me.vendor.currency,
    can: {
      editVendor: isAdmin,
      branchPhotos: (branchId) => isAdmin || branchId === me.branchId,
      manageStaff: true,
      inviteRoles: isAdmin ? ['branch_manager', 'staff'] : ['staff'],
      fixedBranchId: isAdmin ? null : me.branchId,
    },
    branches: vendorApi.branches,
    createBranch: vendorApi.createBranch,
    updateBranch: vendorApi.updateBranch,
    pointRules: vendorApi.pointRules,
    publishRule: vendorApi.publishRule,
    deactivateRule: vendorApi.deactivateRule,
    rewards: vendorApi.rewards,
    createReward: vendorApi.createReward,
    updateReward: vendorApi.updateReward,
    images: vendorApi.images,
    uploadImage: vendorApi.uploadImage,
    deleteImage: vendorApi.deleteImage,
    staff: vendorApi.staff,
    updateStaff: vendorApi.updateStaff,
    inviteStaff: vendorApi.inviteStaff,
  };
}
