import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { StaffContext } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { entitlementsFor, FEATURE_PLAN, type Entitlements, type Feature } from './entitlements';

export type Limit = 'activeRewards' | 'staffPerBranch' | 'menuImages';

/**
 * Checks a merchant's plan before a vendor-side action. Errors: 403 `plan_required`
 * {feature, requiredPlan} for a feature the plan doesn't have, 409 `plan_limit`
 * {limit, max, plan} when adding one more would go over a limit. The dvote team working in a
 * merchant's workspace (ctx.adminId) is never limited.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async of(vendorId: string): Promise<Entitlements> {
    const v = await this.prisma.vendors.findUniqueOrThrow({ where: { id: vendorId }, select: { plan_status: true, plan: true } });
    return entitlementsFor(v);
  }

  async require(ctx: StaffContext, feature: Feature): Promise<void> {
    if (ctx.adminId) return;
    const e = await this.of(ctx.vendorId);
    if (!e.features[feature]) {
      throw new ForbiddenException({
        code: 'plan_required',
        message: `Your plan doesn't include this. Upgrade to ${FEATURE_PLAN[feature]} to use it.`,
        feature,
        requiredPlan: FEATURE_PLAN[feature],
      });
    }
  }

  /** Before adding `adding` more of something: refuse if the shop would go over its plan's limit. */
  async checkLimit(ctx: StaffContext, limit: Limit, adding = 1): Promise<void> {
    if (ctx.adminId || adding <= 0) return;
    const e = await this.of(ctx.vendorId);
    let max = e.limits[limit];
    if (max === null) return;
    let used: number;
    if (limit === 'activeRewards') {
      used = await this.prisma.rewards.count({ where: { vendor_id: ctx.vendorId, status: 'active' } });
    } else if (limit === 'menuImages') {
      used = await this.prisma.vendor_images.count({ where: { vendor_id: ctx.vendorId, kind: 'menu' } });
    } else {
      const branches = await this.prisma.branches.count({ where: { vendor_id: ctx.vendorId, status: 'active' } });
      max = max * Math.max(1, branches);
      used = await this.prisma.staff_users.count({ where: { vendor_id: ctx.vendorId, status: 'active', role: { not: 'vendor_admin' } } });
    }
    if (used + adding > max) {
      throw new ConflictException({
        code: 'plan_limit',
        message: `Your ${e.tier} plan allows ${max}. Upgrade for more.`,
        limit,
        max,
        used,
        plan: e.tier,
      });
    }
  }
}
