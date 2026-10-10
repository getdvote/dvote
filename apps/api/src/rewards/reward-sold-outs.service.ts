import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/** Longest a timed sold-out can last; longer = "until turned back on" (until: null). */
const MAX_DAYS = 31;

/** Rows that count right now: no end time, or an end time still ahead. */
export const activeSoldOut = (): Prisma.reward_sold_outsWhereInput => ({
  OR: [{ sold_out_until: null }, { sold_out_until: { gt: new Date() } }],
});

/** Whether a reward can't be given at this branch right now (scans use it). */
export async function isSoldOut(
  prisma: PrismaService,
  rewardId: string,
  branchId: string,
): Promise<boolean> {
  const row = await prisma.reward_sold_outs.findFirst({
    where: { reward_id: rewardId, branch_id: branchId, ...activeSoldOut() },
    select: { id: true },
  });
  return !!row;
}

/** Sold out at every open branch of the vendor right now (nowhere to redeem it). */
export async function isSoldOutEverywhere(prisma: PrismaService, rewardId: string, vendorId: string): Promise<boolean> {
  const [open, out] = await Promise.all([
    prisma.branches.count({ where: { vendor_id: vendorId, status: 'active' } }),
    prisma.reward_sold_outs.count({ where: { reward_id: rewardId, branches: { status: 'active' }, ...activeSoldOut() } }),
  ]);
  return open > 0 && out >= open;
}

export interface SoldOut {
  rewardId: string;
  branchId: string;
  branchName: string;
  /** null = until someone turns it back on */
  until: string | null;
}

/**
 * Per-branch "sold out" for rewards. A branch manager marks their own branch; a vendor admin
 * marks one branch or every open branch at once. Turning it back on sets the end time to now,
 * so rows are never deleted and a timed sold-out ends by itself.
 */
@Injectable()
export class RewardSoldOutsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every reward sold out right now at my vendor's open branches. */
  async list(vendorId: string, rewardId?: string): Promise<SoldOut[]> {
    const rows = await this.prisma.reward_sold_outs.findMany({
      where: {
        vendor_id: vendorId,
        ...(rewardId ? { reward_id: rewardId } : {}),
        branches: { status: 'active' },
        ...activeSoldOut(),
      },
      include: { branches: { select: { name: true } } },
      orderBy: [{ branches: { name: 'asc' } }],
    });
    return rows.map((r) => ({
      rewardId: r.reward_id,
      branchId: r.branch_id,
      branchName: r.branches.name,
      until: r.sold_out_until?.toISOString() ?? null,
    }));
  }

  /** Marks a reward sold out until `until` (ISO time, or null = until turned back on). */
  async set(
    ctx: StaffContext,
    rewardId: string,
    branchId: string | undefined,
    until: string | null,
  ): Promise<SoldOut[]> {
    await this.assertReward(ctx.vendorId, rewardId);
    const end = until === null ? null : new Date(until);
    if (end) {
      if (end.getTime() <= Date.now())
        throw new BadRequestException({ code: 'until_in_past' });
      if (end.getTime() > Date.now() + MAX_DAYS * 86_400_000)
        throw new BadRequestException({ code: 'until_too_far' });
    }
    const branches = await this.branches(ctx, branchId);
    await this.prisma.$transaction(
      branches.map((b) =>
        this.prisma.reward_sold_outs.upsert({
          where: { reward_id_branch_id: { reward_id: rewardId, branch_id: b } },
          create: {
            vendor_id: ctx.vendorId,
            reward_id: rewardId,
            branch_id: b,
            sold_out_until: end,
            set_by_staff_id: ctx.staffId,
          },
          update: { sold_out_until: end, set_by_staff_id: ctx.staffId },
        }),
      ),
    );
    return this.list(ctx.vendorId, rewardId);
  }

  /** Available again at one branch (or, for a vendor admin with no branch, everywhere). */
  async clear(
    ctx: StaffContext,
    rewardId: string,
    branchId: string | undefined,
  ): Promise<SoldOut[]> {
    await this.assertReward(ctx.vendorId, rewardId);
    const branches = await this.branches(ctx, branchId);
    await this.prisma.reward_sold_outs.updateMany({
      where: {
        vendor_id: ctx.vendorId,
        reward_id: rewardId,
        branch_id: { in: branches },
        ...activeSoldOut(),
      },
      data: { sold_out_until: new Date(), set_by_staff_id: ctx.staffId },
    });
    return this.list(ctx.vendorId, rewardId);
  }

  /** The branches a change applies to: a manager's own; an admin's chosen one, or all open ones. */
  private async branches(
    ctx: StaffContext,
    requested?: string,
  ): Promise<string[]> {
    if (ctx.role !== 'vendor_admin') {
      if (requested && requested !== ctx.branchId)
        throw new ForbiddenException({ code: 'forbidden_branch' });
      return [ctx.branchId!];
    }
    const open = await this.prisma.branches.findMany({
      where: {
        vendor_id: ctx.vendorId,
        status: 'active',
        ...(requested ? { id: requested } : {}),
      },
      select: { id: true },
    });
    if (requested && !open.length)
      throw new BadRequestException({ code: 'invalid_branch' });
    return open.map((b) => b.id);
  }

  private async assertReward(vendorId: string, rewardId: string) {
    const found = await this.prisma.rewards.findFirst({
      where: { id: rewardId, vendor_id: vendorId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException({ code: 'reward_not_found' });
  }
}
