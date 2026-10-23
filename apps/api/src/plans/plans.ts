/**
 * dvote's plans and prices (decided 2026-10-23, docs/billing-gating-spec.md). Whole EGP, VAT not
 * included. Each plan price includes the first branch; every extra branch adds `extraBranch`.
 * Annual billing = pay 10 months, get 12 (shown per month, rounded as in the spec).
 * The landing page (apps/landing/src/lib/plans.ts) keeps a fallback copy: keep both identical.
 */
export const PLANS = ['regular', 'loyal', 'chain'] as const;
export type Plan = (typeof PLANS)[number];

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export interface PlanPrice {
  id: Plan;
  /** Per month, first branch included. */
  monthly: number;
  /** Per month when paid yearly. */
  annual: number;
  /** One year paid at once. */
  annualTotal: number;
  /** Each extra branch, per month. */
  extraBranch: { monthly: number; annual: number };
  /** The plan price for Founding Merchants during their first FOUNDING.months (extra branches stay full price). */
  foundingMonthly: number;
}

export const PLAN_PRICES: readonly PlanPrice[] = [
  { id: 'regular', monthly: 499, annual: 416, annualTotal: 4990, extraBranch: { monthly: 299, annual: 249 }, foundingMonthly: 349 },
  { id: 'loyal', monthly: 999, annual: 833, annualTotal: 9990, extraBranch: { monthly: 399, annual: 333 }, foundingMonthly: 699 },
  { id: 'chain', monthly: 1999, annual: 1666, annualTotal: 19990, extraBranch: { monthly: 499, annual: 416 }, foundingMonthly: 1399 },
];

/** Founding Merchants: the first merchants (not branches) get 30% off their plan for 6 months. */
export const FOUNDING = { discountPercent: 30, months: 6, defaultTotal: 10, maxTotal: 100 };

/** Monthly price of a plan for a number of branches. */
export function monthlyPrice(plan: Plan, branches: number, cycle: BillingCycle = 'monthly'): number {
  const p = PLAN_PRICES.find((x) => x.id === plan)!;
  const extra = Math.max(0, Math.floor(branches) - 1);
  return cycle === 'annual' ? p.annual + extra * p.extraBranch.annual : p.monthly + extra * p.extraBranch.monthly;
}
