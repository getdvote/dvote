import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TRIAL } from '../trial/trial-rules';
import { BILLING, PLAN_PRICES, PLAN_RANK, quote, type BillingCycle, type Plan } from '../plans/plans';
import { entitlementsFor } from '../plans/entitlements';

const DAY = 24 * 60 * 60 * 1000;

const SELECT = {
  id: true,
  plan_status: true,
  plan: true,
  billing_cycle: true,
  founding: true,
  founding_until: true,
  trial_ends_at: true,
  delete_at: true,
  paid_until: true,
  next_plan: true,
  next_billing_cycle: true,
} as const;

/**
 * The merchant's Billing page: the current plan and price for its open branches, when it renews or
 * the trial ends, and plan changes. Until Paymob, money is collected by the dvote team, who renew the
 * paid period (admin plan action `renew`). Upgrades apply at once; downgrades and switching between
 * monthly and annual wait for the end of the paid period.
 */
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(vendorId: string, now = new Date()) {
    const [v, branches] = await Promise.all([
      this.prisma.vendors.findUnique({ where: { id: vendorId }, select: SELECT }),
      this.prisma.branches.count({ where: { vendor_id: vendorId, status: 'active' } }),
    ]);
    if (!v) throw new NotFoundException({ code: 'vendor_not_found' });
    const branchCount = Math.max(1, branches);
    const foundingActive = v.founding && !!v.founding_until && v.founding_until > now;
    const plan = (v.plan as Plan | null) ?? null;
    const cycle = (v.billing_cycle as BillingCycle | null) ?? 'monthly';
    const graceEndsAt = v.paid_until ? new Date(v.paid_until.getTime() + BILLING.graceDays * DAY) : null;
    const state =
      v.plan_status === 'trial'
        ? 'trial'
        : !v.paid_until
          ? 'managed'
          : v.paid_until > now
            ? 'active'
            : graceEndsAt! > now
              ? 'grace'
              : 'expired';
    const nextPlan = (v.next_plan as Plan | null) ?? null;
    const nextCycle = (v.next_billing_cycle as BillingCycle | null) ?? null;
    return {
      currency: 'EGP',
      state,
      entitlements: entitlementsFor(v),
      planStatus: v.plan_status as 'trial' | 'active',
      plan,
      billingCycle: plan ? cycle : null,
      branches: branchCount,
      price: plan ? quote(plan, cycle, branchCount, foundingActive) : null,
      trialEndsAt: v.trial_ends_at?.toISOString() ?? null,
      trialDays: TRIAL.trialDays,
      deleteAt: v.delete_at?.toISOString() ?? null,
      paidUntil: v.paid_until?.toISOString() ?? null,
      graceEndsAt: graceEndsAt?.toISOString() ?? null,
      graceDays: BILLING.graceDays,
      founding: v.founding,
      foundingUntil: foundingActive ? v.founding_until!.toISOString() : null,
      scheduled:
        nextPlan && nextCycle
          ? {
              plan: nextPlan,
              billingCycle: nextCycle,
              startsAt: v.paid_until?.toISOString() ?? null,
              price: quote(nextPlan, nextCycle, branchCount, foundingActive),
            }
          : null,
      plans: PLAN_PRICES.map((p) => ({
        id: p.id,
        monthly: quote(p.id, 'monthly', branchCount, foundingActive),
        annual: quote(p.id, 'annual', branchCount, foundingActive),
      })),
    };
  }

  /**
   * Merchant admin picks a plan. On a trial (or a shop dvote manages without a paid period) it
   * switches at once. On a paid period: a higher plan applies at once (same billing cycle; a cycle
   * switch waits for renewal), anything else is scheduled for the end of the paid period; picking
   * the current plan and cycle cancels a scheduled change.
   */
  async change(vendorId: string, plan: Plan, cycle: BillingCycle) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM vendors WHERE id = ${vendorId}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException({ code: 'vendor_not_found' });
      const v = await tx.vendors.findUniqueOrThrow({ where: { id: vendorId }, select: SELECT });
      const current = (v.plan as Plan | null) ?? null;
      const currentCycle = (v.billing_cycle as BillingCycle | null) ?? 'monthly';

      if (v.plan_status === 'trial' || !v.paid_until || !current) {
        await tx.vendors.update({
          where: { id: vendorId },
          data: { plan, billing_cycle: cycle, next_plan: null, next_billing_cycle: null },
        });
        return;
      }
      if (plan === current && cycle === currentCycle) {
        await tx.vendors.update({ where: { id: vendorId }, data: { next_plan: null, next_billing_cycle: null } });
        return;
      }
      if (PLAN_RANK[plan] > PLAN_RANK[current]) {
        await tx.vendors.update({
          where: { id: vendorId },
          data: {
            plan,
            ...(cycle === currentCycle ? { next_plan: null, next_billing_cycle: null } : { next_plan: plan, next_billing_cycle: cycle }),
          },
        });
        return;
      }
      await tx.vendors.update({ where: { id: vendorId }, data: { next_plan: plan, next_billing_cycle: cycle } });
    });
    return this.get(vendorId);
  }

  /** Drop a scheduled downgrade / cycle switch. */
  async cancelScheduled(vendorId: string) {
    const r = await this.prisma.vendors.updateMany({
      where: { id: vendorId, next_plan: { not: null } },
      data: { next_plan: null, next_billing_cycle: null },
    });
    if (!r.count) throw new ConflictException({ code: 'nothing_scheduled', message: 'No plan change is scheduled.' });
    return this.get(vendorId);
  }
}
