import { useAuth } from './auth';
import { useWorkspace } from './vendor-workspace';
import type { PlanName } from './api';

/** Same as apps/api/src/plans/entitlements.ts (keep both identical). */
export type Feature =
  | 'insights'
  | 'branch_comparison'
  | 'custom_segments'
  | 'customer_export'
  | 'nearby'
  | 'card_design'
  | 'brand_style'
  | 'remove_branding';

export interface Entitlements {
  tier: PlanName;
  trial: boolean;
  features: Record<Feature, boolean>;
  limits: {
    activeRewards: number | null;
    staffPerBranch: number | null;
    menuImages: number | null;
    broadcasts: { count: number; windowHours: number; perBranch: boolean };
  };
}

/** The lowest plan that has a feature (for "Available on Loyal"). */
export const FEATURE_PLAN: Record<Feature, PlanName> = {
  insights: 'loyal',
  branch_comparison: 'chain',
  custom_segments: 'loyal',
  customer_export: 'loyal',
  nearby: 'loyal',
  card_design: 'loyal',
  brand_style: 'loyal',
  remove_branding: 'loyal',
};

/**
 * What the signed-in merchant's plan includes (from /staff/me). The dvote team (admin pages and the
 * merchant workspace) and a missing value (older API) get everything, like the API does.
 */
export function useEntitlements(): Entitlements | null {
  const { staff } = useAuth();
  const workspace = useWorkspace();
  if (workspace || !staff) return null;
  return staff.vendor.plan?.entitlements ?? null;
}

/** true when the plan has the feature (or there are no limits to apply). */
export function useHasFeature(feature: Feature): boolean {
  const e = useEntitlements();
  return !e || e.features[feature];
}
