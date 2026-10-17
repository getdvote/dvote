import type { StaffRole } from './api';

/**
 * What each team role may do, as shown when inviting someone. Roles are fixed bundles (no
 * per-person ticks); the API enforces the same split. `soon` = not built yet, listed so the
 * bundles read complete.
 */
export const PERMISSION_GROUPS = [
  { key: 'till', items: [{ key: 'scan' }, { key: 'collect' }, { key: 'redeem' }] },
  { key: 'rewards', items: [{ key: 'manageRewards' }, { key: 'soldOut' }] },
  { key: 'members', items: [{ key: 'viewCustomers' }, { key: 'viewPhone' }, { key: 'segments' }] },
  { key: 'programs', items: [{ key: 'manageCard' }, { key: 'manageMenu' }, { key: 'manageMessages', soon: true }] },
  { key: 'insight', items: [{ key: 'viewAnalytics' }, { key: 'exportCustomers' }] },
  {
    key: 'operations',
    items: [
      { key: 'manageBranches' },
      { key: 'manageTeam' },
      { key: 'manageBranding' },
      { key: 'manageIntegrations', soon: true },
      { key: 'replyReviews', soon: true },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]['items'][number]['key'];

const ALL = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)) as Permission[];

/** Roles in the order they are offered. */
export const ROLES: StaffRole[] = ['vendor_admin', 'branch_manager', 'staff', 'viewer'];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  vendor_admin: ALL,
  // their branch only (team: cashiers of their branch)
  branch_manager: ['scan', 'collect', 'redeem', 'soldOut', 'viewCustomers', 'viewPhone', 'viewAnalytics', 'manageTeam'],
  staff: ['scan', 'collect', 'redeem'],
  // every branch, nothing changes
  viewer: ['viewCustomers', 'viewPhone', 'viewAnalytics'],
};

/** Roles without a branch: they see every branch. */
export const MERCHANT_WIDE: StaffRole[] = ['vendor_admin', 'viewer'];
