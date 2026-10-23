import { useEffect, useState } from 'react';
import { config } from './config';

/**
 * The public plans (docs/billing-gating-spec.md), read from `GET /api/public/plans`. The page starts
 * with the built-in copy below and swaps in the API answer, so it never shows blanks when the API is
 * down. Prices are whole EGP, excluding VAT; `annual` is per month on annual billing.
 */
export type PlanId = 'regular' | 'loyal' | 'chain';
export type Cycle = 'monthly' | 'annual';

export type Plan = {
  id: PlanId;
  monthly: number;
  annual: number;
  extraBranch: { monthly: number; annual: number };
  foundingMonthly: number;
};

export type PlansData = {
  currency: string;
  trialDays: number;
  plans: Plan[];
  founding: { total: number; taken: number; left: number; open: boolean };
};

export const FALLBACK_PLANS: PlansData = {
  currency: 'EGP',
  trialDays: 14,
  plans: [
    { id: 'regular', monthly: 499, annual: 416, extraBranch: { monthly: 299, annual: 249 }, foundingMonthly: 349 },
    { id: 'loyal', monthly: 999, annual: 833, extraBranch: { monthly: 399, annual: 333 }, foundingMonthly: 699 },
    { id: 'chain', monthly: 1999, annual: 1666, extraBranch: { monthly: 499, annual: 416 }, foundingMonthly: 1399 },
  ],
  founding: { total: 10, taken: 0, left: 10, open: true },
};

export const PLAN_IDS: PlanId[] = ['regular', 'loyal', 'chain'];
export const MAX_BRANCHES = 20;

/** Monthly price for this many branches: base (first branch included) + each extra branch. */
export function monthlyPrice(plan: Plan, cycle: Cycle, branches: number): number {
  const extra = Math.max(0, branches - 1);
  return cycle === 'annual' ? plan.annual + extra * plan.extraBranch.annual : plan.monthly + extra * plan.extraBranch.monthly;
}

/** One year paid at once on annual billing: ten months of the monthly price (4,990 for Regular, 1 branch). */
export function yearlyPrice(plan: Plan, branches: number): number {
  return (plan.monthly + Math.max(0, branches - 1) * plan.extraBranch.monthly) * 10;
}

/** Founding price per month: 30% off the plan for 6 months; extra branches stay at full monthly price. */
export function foundingPrice(plan: Plan, branches: number): number {
  return plan.foundingMonthly + Math.max(0, branches - 1) * plan.extraBranch.monthly;
}

export const formatMoney = (n: number) => n.toLocaleString('en-US');

function valid(x: unknown): x is PlansData {
  const d = x as PlansData;
  return (
    !!d &&
    Array.isArray(d.plans) &&
    PLAN_IDS.every((id) => d.plans.some((p) => p.id === id && Number.isFinite(p.monthly) && Number.isFinite(p.annual) && !!p.extraBranch)) &&
    !!d.founding &&
    Number.isFinite(d.founding.left)
  );
}

let cache: Promise<PlansData | null> | null = null;
function load(): Promise<PlansData | null> {
  cache ??= fetch(`${config.apiUrl}/api/public/plans`, { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (valid(j) ? { ...j, plans: PLAN_IDS.map((id) => j.plans.find((p) => p.id === id)!) } : null))
    .catch(() => null);
  return cache;
}

/** Plans + Founding counter; the fallback until (or unless) the API answers. */
export function usePlans(): PlansData {
  const [data, setData] = useState<PlansData>(FALLBACK_PLANS);
  useEffect(() => {
    let live = true;
    load().then((d) => {
      if (live && d) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);
  return data;
}

export const planById = (data: PlansData, id: PlanId) => data.plans.find((p) => p.id === id)!;
