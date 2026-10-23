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

/** Billing period rules (decided 2026-10-23). */
export const BILLING = {
  /** After paid_until the shop keeps working this long (with a warning), then the dashboard locks. */
  graceDays: 7,
};

/** Higher = more. Moving up applies at once; moving down waits for the end of the paid period. */
export const PLAN_RANK: Record<Plan, number> = { regular: 1, loyal: 2, chain: 3 };

/** The end of one billing period that starts at `from`. */
export function addPeriod(from: Date, cycle: BillingCycle): Date {
  const months = cycle === 'annual' ? 12 : 1;
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Jan 31 + 1 month = Feb 28/29, not Mar 3
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export interface PriceQuote {
  /** The plan's own price per month (first branch), after any Founding discount. */
  base: number;
  /** Extra branches per month (never discounted). */
  extraBranches: number;
  /** Per month in total. */
  monthly: number;
  /** What one period costs: a month, or a year (the plan's yearly price + 12 months of extra branches). */
  perPeriod: number;
  foundingApplied: boolean;
}

/** What a shop with `branches` open branches pays on a plan. */
export function quote(plan: Plan, cycle: BillingCycle, branches: number, founding = false): PriceQuote {
  const p = PLAN_PRICES.find((x) => x.id === plan)!;
  const extra = Math.max(0, Math.floor(branches) - 1);
  const listBase = cycle === 'annual' ? p.annual : p.monthly;
  const base = founding
    ? cycle === 'annual'
      ? Math.round((listBase * (100 - FOUNDING.discountPercent)) / 100)
      : p.foundingMonthly
    : listBase;
  const extraBranches = extra * (cycle === 'annual' ? p.extraBranch.annual : p.extraBranch.monthly);
  const monthly = base + extraBranches;
  const off = (n: number) => (founding ? Math.round((n * (100 - FOUNDING.discountPercent)) / 100) : n);
  const perPeriod = cycle === 'annual' ? off(p.annualTotal) + extraBranches * 12 : monthly;
  return { base, extraBranches, monthly, perPeriod, foundingApplied: founding };
}
