import type { Plan } from './plans';

/**
 * What each plan includes (decided 2026-10-23, docs/billing-gating-spec.md). One list for the API
 * (enforced in the vendor controllers) and the dashboard (which shows locked features with an
 * Upgrade link; copy in apps/dashboard/src/lib/entitlements.ts, keep both identical).
 * - A free trial gets everything (Chain level) for its 14 days.
 * - A shop with no plan (made or activated by dvote before plans existed) gets everything too.
 * - Moving down never deletes or switches anything off: over a limit, the shop just can't add more.
 */
export type Feature =
  /** Insights page, reward performance and visit patterns (Regular: activity log and totals only). */
  | 'insights'
  /** Insights split by branch (Chain). */
  | 'branch_comparison'
  /** Custom customer segments. */
  | 'custom_segments'
  /** Customers CSV export (with contact details). */
  | 'customer_export'
  /** Nearby (geo) reminders on the Wallet pass. */
  | 'nearby'
  /** Card design editor: colours, background, versions (Regular keeps its current card look). */
  | 'card_design'
  /** Storefront page style, brand colours and font. */
  | 'brand_style'
  /** No "Powered by dvote" on the storefront. */
  | 'remove_branding';

export interface Entitlements {
  /** The plan whose features apply: a trial or a no-plan shop counts as Chain. */
  tier: Plan;
  trial: boolean;
  features: Record<Feature, boolean>;
  limits: {
    /** Active rewards at once (null = no limit). */
    activeRewards: number | null;
    /** Team members (everyone but the merchant admin) per open branch. */
    staffPerBranch: number | null;
    menuImages: number | null;
    /** Broadcasts per window; `perBranch` multiplies by the open branches. */
    broadcasts: { count: number; windowHours: number; perBranch: boolean };
  };
}

const ALL: Record<Feature, boolean> = {
  insights: true,
  branch_comparison: true,
  custom_segments: true,
  customer_export: true,
  nearby: true,
  card_design: true,
  brand_style: true,
  remove_branding: true,
};

const TIERS: Record<Plan, Omit<Entitlements, 'tier' | 'trial'>> = {
  regular: {
    features: {
      insights: false,
      branch_comparison: false,
      custom_segments: false,
      customer_export: false,
      nearby: false,
      card_design: false,
      brand_style: false,
      remove_branding: false,
    },
    limits: { activeRewards: 5, staffPerBranch: 3, menuImages: 3, broadcasts: { count: 2, windowHours: 7 * 24, perBranch: false } },
  },
  loyal: {
    features: { ...ALL, branch_comparison: false },
    limits: { activeRewards: null, staffPerBranch: null, menuImages: null, broadcasts: { count: 3, windowHours: 24, perBranch: false } },
  },
  chain: {
    features: ALL,
    limits: { activeRewards: null, staffPerBranch: null, menuImages: null, broadcasts: { count: 3, windowHours: 24, perBranch: true } },
  },
};

/** The lowest plan that has a feature (for "Available on Loyal"). */
export const FEATURE_PLAN: Record<Feature, Plan> = {
  insights: 'loyal',
  branch_comparison: 'chain',
  custom_segments: 'loyal',
  customer_export: 'loyal',
  nearby: 'loyal',
  card_design: 'loyal',
  brand_style: 'loyal',
  remove_branding: 'loyal',
};

export function entitlementsFor(v: { plan_status: string; plan: string | null }): Entitlements {
  const trial = v.plan_status === 'trial';
  const tier: Plan = trial || !v.plan ? 'chain' : (v.plan as Plan);
  return { tier, trial, ...TIERS[tier] };
}
