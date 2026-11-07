import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { TRIAL } from '../trial/trial-rules';
import { BILLING, PLAN_PRICES, PLAN_RANK, prorate, quote, type BillingCycle, type Plan } from '../plans/plans';
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
  paid_until: true,
  paid_branches: true,
  next_plan: true,
  next_billing_cycle: true,
  next_paid_branches: true,
} as const;

export interface PlanChange {
  plan: Plan;
  billingCycle: BillingCycle;
  /** Branches the plan should cover; default = what it covers now. */
  branches?: number;
  /** Downgrades: which open branches and active rewards stay (the rest close / are archived). */
  keepBranchIds?: string[];
  keepRewardIds?: string[];
}

type Request = {
  id: string;
  plan: string;
  billing_cycle: string;
  branches: number;
  kind: string;
  status: string;
  amount_due: { toNumber(): number } | number;
  period_price: { toNumber(): number } | number;
  created_at: Date;
  reviewed_at: Date | null;
  review_note: string | null;
};

const num = (d: { toNumber(): number } | number) => (typeof d === 'number' ? d : d.toNumber());

/**
 * The merchant's Billing page: the current plan and price, when it renews (or the trial ends), and
 * plan changes. Until Paymob (decided 2026-11-07): during a trial (or for a shop dvote runs without a
 * paid period) a pick is just saved; on a paid plan every change is a **request** the dvote team
 * approves after taking the money (admin Plan requests). Upgrades (higher plan / more branches) cost
 * the difference for the days left and start on approval; downgrades (lower plan / fewer branches)
 * and monthly ↔ annual start at the end of the paid period, when the shop is forced down to them.
 */
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(vendorId: string, now = new Date()) {
    const [v, openBranches, activeRewards, pending, last] = await Promise.all([
      this.prisma.vendors.findUnique({ where: { id: vendorId }, select: SELECT }),
      this.prisma.branches.count({ where: { vendor_id: vendorId, status: 'active' } }),
      this.prisma.rewards.count({ where: { vendor_id: vendorId, status: 'active' } }),
      this.prisma.plan_requests.findFirst({ where: { vendor_id: vendorId, status: 'pending' } }),
      this.prisma.plan_requests.findFirst({
        where: { vendor_id: vendorId, status: { in: ['approved', 'rejected'] } },
        orderBy: { reviewed_at: 'desc' },
      }),
    ]);
    if (!v) throw new NotFoundException({ code: 'vendor_not_found' });
    const branchCount = Math.max(1, v.paid_branches ?? openBranches);
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
    const nextBranches = v.next_paid_branches ?? branchCount;
    return {
      currency: 'EGP',
      state,
      entitlements: entitlementsFor(v),
      planStatus: v.plan_status as 'trial' | 'active',
      plan,
      billingCycle: plan ? cycle : null,
      branches: branchCount,
      /** Open branches the paid plan covers (null = no limit: a trial or a shop dvote runs). */
      paidBranches: v.paid_branches,
      openBranches,
      activeRewards,
      /** Changes go through a request the dvote team approves (a paid plan). */
      requestsRequired: this.paid(v),
      price: plan ? quote(plan, cycle, branchCount, foundingActive) : null,
      trialEndsAt: v.trial_ends_at?.toISOString() ?? null,
      trialDays: TRIAL.trialDays,
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
              branches: nextBranches,
              startsAt: v.paid_until?.toISOString() ?? null,
              price: quote(nextPlan, nextCycle, nextBranches, foundingActive),
            }
          : null,
      pendingRequest: pending ? this.requestDto(pending) : null,
      lastDecision: last ? this.requestDto(last) : null,
      plans: PLAN_PRICES.map((p) => ({
        id: p.id,
        monthly: quote(p.id, 'monthly', branchCount, foundingActive),
        annual: quote(p.id, 'annual', branchCount, foundingActive),
        // on a paid plan: what moving up to this plan (same branches and billing) costs now
        upgradeDueNow:
          this.paid(v) && plan && PLAN_RANK[p.id] > PLAN_RANK[plan] && v.paid_until
            ? prorate(quote(plan, cycle, branchCount, foundingActive).perPeriod, quote(p.id, cycle, branchCount, foundingActive).perPeriod, v.paid_until, cycle, now)
            : null,
      })),
    };
  }

  /** What a change would be and cost, without sending it (the dashboard's confirmation). */
  async preview(vendorId: string, change: PlanChange, now = new Date()) {
    const v = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: SELECT });
    if (!v) throw new NotFoundException({ code: 'vendor_not_found' });
    const openBranches = await this.prisma.branches.count({ where: { vendor_id: vendorId, status: 'active' } });
    return this.classify(v, openBranches, change, now);
  }

  /**
   * Merchant admin picks a plan. On a trial (or a shop dvote runs without a paid period) the choice
   * is saved at once (nothing is charged; dvote activates it after payment). On a paid plan it
   * becomes a pending request (409 request_pending while another is open).
   */
  async change(vendorId: string, staffId: string, change: PlanChange, now = new Date()) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM vendors WHERE id = ${vendorId}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException({ code: 'vendor_not_found' });
      const v = await tx.vendors.findUniqueOrThrow({ where: { id: vendorId }, select: SELECT });

      if (!this.paid(v)) {
        await tx.vendors.update({
          where: { id: vendorId },
          data: { plan: change.plan, billing_cycle: change.billingCycle, next_plan: null, next_billing_cycle: null, next_paid_branches: null },
        });
        return;
      }
      if (await tx.plan_requests.findFirst({ where: { vendor_id: vendorId, status: 'pending' }, select: { id: true } })) {
        throw new ConflictException({ code: 'request_pending', message: 'A plan change is already waiting for dvote.' });
      }
      const openBranches = await tx.branches.count({ where: { vendor_id: vendorId, status: 'active' } });
      const c = await this.classify(v, openBranches, change, now, tx);
      await tx.plan_requests.create({
        data: {
          vendor_id: vendorId,
          requested_by: staffId,
          from_plan: v.plan,
          from_cycle: v.billing_cycle,
          from_branches: v.paid_branches,
          plan: change.plan,
          billing_cycle: change.billingCycle,
          branches: c.branches,
          keep_branch_ids: c.keepBranchIds,
          keep_reward_ids: c.keepRewardIds,
          amount_due: c.amountDue,
          period_price: c.periodPrice,
          kind: c.kind,
        },
      });
    });
    return this.get(vendorId);
  }

  /** Merchant takes back their pending request. */
  async cancelRequest(vendorId: string) {
    const r = await this.prisma.plan_requests.updateMany({ where: { vendor_id: vendorId, status: 'pending' }, data: { status: 'cancelled' } });
    if (!r.count) throw new ConflictException({ code: 'no_pending_request', message: 'No plan change is waiting.' });
    return this.get(vendorId);
  }

  /** Drop an approved downgrade / cycle switch before it starts. */
  async cancelScheduled(vendorId: string) {
    const r = await this.prisma.vendors.updateMany({
      where: { id: vendorId, next_plan: { not: null } },
      data: { next_plan: null, next_billing_cycle: null, next_paid_branches: null },
    });
    if (!r.count) throw new ConflictException({ code: 'nothing_scheduled', message: 'No plan change is scheduled.' });
    return this.get(vendorId);
  }

  /** A paid period (dvote set paid_until): changes need approval. */
  private paid(v: { plan_status: string; paid_until: Date | null; plan: string | null }) {
    return v.plan_status === 'active' && !!v.paid_until && !!v.plan;
  }

  /**
   * Works out a change on a paid plan: `upgrade` (plan up and/or more branches, nothing down) starts
   * on approval and costs the difference for the days left; `downgrade` (plan down and/or fewer
   * branches, nothing up) and `change` (only monthly ↔ annual) start at the end of the period, free.
   * Going up in one thing and down in another at once is refused (400 split_change): two requests.
   * A downgrade below what is open must say what stays (400 keep_required / invalid_keep).
   */
  private async classify(
    v: { id: string; plan: string | null; billing_cycle: string | null; paid_branches: number | null; paid_until: Date | null; founding: boolean; founding_until: Date | null },
    openBranches: number,
    change: PlanChange,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const current = (v.plan as Plan | null) ?? change.plan;
    const cycle = (v.billing_cycle as BillingCycle | null) ?? 'monthly';
    const have = Math.max(1, v.paid_branches ?? openBranches);
    const branches = Math.max(1, Math.floor(change.branches ?? have));
    if (branches > 500) throw new BadRequestException({ code: 'invalid_branches', message: 'At most 500 branches.' });
    const up = PLAN_RANK[change.plan] > PLAN_RANK[current] || branches > have;
    const down = PLAN_RANK[change.plan] < PLAN_RANK[current] || branches < have;
    if (up && down) {
      throw new BadRequestException({ code: 'split_change', message: 'Change the plan and the number of branches in two requests.' });
    }
    if (!up && !down && change.billingCycle === cycle) {
      throw new BadRequestException({ code: 'no_change', message: 'This is already your plan.' });
    }
    const founding = v.founding && !!v.founding_until && v.founding_until > now;
    const periodPrice = quote(change.plan, change.billingCycle, branches, founding).perPeriod;
    let amountDue = 0;
    if (up && v.paid_until) {
      // the upgrade is charged on the current billing cycle; a cycle switch waits for renewal
      amountDue = prorate(quote(current, cycle, have, founding).perPeriod, quote(change.plan, cycle, branches, founding).perPeriod, v.paid_until, cycle, now);
    }

    let keepBranchIds: string[] = [];
    let keepRewardIds: string[] = [];
    if (down) {
      if (branches < openBranches) keepBranchIds = await this.checkKeep(db, 'branches', v.id, change.keepBranchIds, branches);
      const maxRewards = entitlementsFor({ plan_status: 'active', plan: change.plan }).limits.activeRewards;
      if (maxRewards !== null) {
        const active = await db.rewards.count({ where: { vendor_id: v.id, status: 'active' } });
        if (active > maxRewards) keepRewardIds = await this.checkKeep(db, 'rewards', v.id, change.keepRewardIds, maxRewards);
      }
    }
    return {
      kind: up ? ('upgrade' as const) : down ? ('downgrade' as const) : ('change' as const),
      branches,
      amountDue,
      periodPrice,
      startsAt: up ? null : (v.paid_until?.toISOString() ?? null),
      keepBranchIds,
      keepRewardIds,
    };
  }

  private async checkKeep(db: Prisma.TransactionClient, what: 'branches' | 'rewards', vendorId: string, ids: string[] | undefined, count: number) {
    const unique = [...new Set(ids ?? [])];
    if (!unique.length) throw new BadRequestException({ code: 'keep_required', message: `Choose the ${what} to keep.`, what, count });
    const where = { id: { in: unique }, vendor_id: vendorId, status: 'active' as const };
    const found = what === 'branches' ? await db.branches.count({ where }) : await db.rewards.count({ where });
    if (found !== unique.length || unique.length !== count) {
      throw new BadRequestException({ code: 'invalid_keep', message: `Choose exactly ${count} of your active ${what}.`, what, count });
    }
    return unique;
  }

  requestDto(r: Request) {
    return {
      id: r.id,
      plan: r.plan as Plan,
      billingCycle: r.billing_cycle as BillingCycle,
      branches: r.branches,
      kind: r.kind as 'upgrade' | 'downgrade' | 'change',
      status: r.status as 'pending' | 'approved' | 'rejected' | 'cancelled',
      amountDue: num(r.amount_due),
      periodPrice: num(r.period_price),
      createdAt: r.created_at.toISOString(),
      reviewedAt: r.reviewed_at?.toISOString() ?? null,
      reviewNote: r.review_note,
    };
  }
}
