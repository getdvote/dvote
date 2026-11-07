import { Prisma } from '../generated/prisma/client.js';
import { entitlementsFor } from '../plans/entitlements';
import { addPeriod, type BillingCycle, type Plan } from '../plans/plans';
import { revokeForStaffChange } from '../scanner/revoke-for-staff-change';

/** The branch and reward ids a merchant chose to keep on a downgrade (vendors.next_keep). */
export interface KeepChoice {
  branches: string[];
  rewards: string[];
}

export function readKeep(raw: unknown): KeepChoice {
  const v = (raw ?? {}) as Partial<KeepChoice>;
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
  return { branches: ids(v.branches), rewards: ids(v.rewards) };
}

/**
 * Forces a shop down to what its plan covers (decided 2026-11-07: "turn off, keep data"). Nothing is
 * deleted, so upgrading again brings everything back by hand:
 * - open branches over `paidBranches` are closed (the ones in `keep.branches` stay, then the oldest);
 * - active rewards over the plan's limit are archived (`keep.rewards` first, then shop order);
 * - team members over the plan's limit are disabled, newest first (their phone scanners end);
 * - nearby reminders are switched off when the plan has none.
 * Locked features (insights, segments, card design, brand style, export) need no change here: the
 * plan check refuses them, and what was saved stays saved.
 */
export async function enforcePlan(
  tx: Prisma.TransactionClient,
  vendorId: string,
  plan: Plan,
  paidBranches: number | null,
  keep: KeepChoice,
): Promise<void> {
  const e = entitlementsFor({ plan_status: 'active', plan });

  if (paidBranches !== null) {
    const open = await tx.branches.findMany({ where: { vendor_id: vendorId, status: 'active' }, orderBy: { created_at: 'asc' }, select: { id: true } });
    if (open.length > paidBranches) {
      const kept = new Set(ordered(open.map((b) => b.id), keep.branches).slice(0, paidBranches));
      const close = open.filter((b) => !kept.has(b.id)).map((b) => b.id);
      await tx.branches.updateMany({ where: { id: { in: close } }, data: { status: 'closed' } });
      // branch staff of a closed branch can't work there any more (their sessions end)
      await disableStaff(tx, await tx.staff_users.findMany({ where: { vendor_id: vendorId, branch_id: { in: close }, status: 'active' } }));
    }
  }

  const maxRewards = e.limits.activeRewards;
  if (maxRewards !== null) {
    const active = await tx.rewards.findMany({
      where: { vendor_id: vendorId, status: 'active' },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      select: { id: true },
    });
    if (active.length > maxRewards) {
      const kept = new Set(ordered(active.map((r) => r.id), keep.rewards).slice(0, maxRewards));
      await tx.rewards.updateMany({ where: { id: { in: active.filter((r) => !kept.has(r.id)).map((r) => r.id) } }, data: { status: 'archived' } });
    }
  }

  const perBranch = e.limits.staffPerBranch;
  if (perBranch !== null) {
    const branches = await tx.branches.count({ where: { vendor_id: vendorId, status: 'active' } });
    const max = perBranch * Math.max(1, branches);
    const team = await tx.staff_users.findMany({
      where: { vendor_id: vendorId, status: 'active', role: { not: 'vendor_admin' } },
      orderBy: { created_at: 'asc' },
    });
    if (team.length > max) await disableStaff(tx, team.slice(max));
  }

  if (!e.features.nearby) {
    await tx.vendors.update({ where: { id: vendorId }, data: { wallet_nearby_enabled: false } });
  }
}

/** Keep the chosen ids first (in the shop's order), then the rest in order. */
function ordered(all: string[], chosen: string[]): string[] {
  const pick = new Set(chosen);
  return [...all.filter((id) => pick.has(id)), ...all.filter((id) => !pick.has(id))];
}

async function disableStaff(tx: Prisma.TransactionClient, rows: { id: string; status: string; role: string; branch_id: string | null }[]) {
  for (const s of rows) {
    const after = { ...s, status: 'disabled' };
    await tx.staff_users.update({ where: { id: s.id }, data: { status: 'disabled' } });
    await revokeForStaffChange(tx, s.id, s, after);
  }
}

/**
 * At the end of a paid period (renewal or the background job): a scheduled downgrade or cycle switch
 * starts, and the shop is forced down to it. `paidUntil` moves one period on only for a renewal.
 */
export async function startScheduled(
  tx: Prisma.TransactionClient,
  v: { id: string; plan: string | null; billing_cycle: string | null; next_plan: string | null; next_billing_cycle: string | null; next_paid_branches: number | null; paid_branches: number | null; next_keep: unknown },
  renewFrom: Date | null,
): Promise<void> {
  const plan = (v.next_plan ?? v.plan) as Plan;
  const cycle = (v.next_billing_cycle ?? v.billing_cycle ?? 'monthly') as BillingCycle;
  const paidBranches = v.next_paid_branches ?? v.paid_branches;
  await tx.vendors.update({
    where: { id: v.id },
    data: {
      plan,
      billing_cycle: cycle,
      paid_branches: paidBranches,
      next_plan: null,
      next_billing_cycle: null,
      next_paid_branches: null,
      next_keep: Prisma.DbNull,
      ...(renewFrom ? { paid_until: addPeriod(renewFrom, cycle), status: 'active' } : {}),
    },
  });
  if (v.next_plan) await enforcePlan(tx, v.id, plan, paidBranches, readKeep(v.next_keep));
}
