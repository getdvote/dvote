import { Controller, Get, Injectable, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Prisma, reward_status } from '../generated/prisma/client.js';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';
import { cairoDays, IsDay } from './cairo-days';

/** A customer is "close" to a reward from this share of its cost (inclusive) until they can afford it. */
export const CLOSE_SHARE = 0.8;

export class VendorRewardPerformanceQueryDto {
  @ApiProperty({
    example: '2026-09-15',
    description: 'First day, Cairo time (inclusive); redemptions only',
  })
  @IsDay()
  from: string;

  @ApiProperty({
    example: '2026-10-14',
    description: 'Last day, Cairo time (inclusive); redemptions only',
  })
  @IsDay()
  to: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Redemptions at this branch only. Ignored for a branch manager (always their branch). Balances are per merchant, never per branch.',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}

class PointsRateDto {
  @ApiProperty({ example: '10.00' }) spendAmount: string;
  @ApiProperty({ example: 1 }) pointsPerSpend: number;
}

class PointsHeldDto {
  @ApiProperty({ description: 'Sum of every customer card balance here' })
  points: number;
  @ApiProperty({ description: 'Customer cards with a balance above 0' })
  customers: number;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '70000.00',
    description:
      'points at the active rule: what customers would spend to earn them. NULL without an active rule',
  })
  worth: string | null;
  @ApiProperty({ type: PointsRateDto, nullable: true })
  rate: PointsRateDto | null;
  @ApiProperty({
    description: 'Customers who can afford at least one active reward now',
  })
  readyToRedeem: number;
  @ApiProperty({
    description: `Customers at ${CLOSE_SHARE * 100}% or more of an active reward's cost but short of it`,
  })
  closeToReward: number;
}

class RewardPerformanceDto {
  @ApiProperty({ format: 'uuid' }) rewardId: string;
  @ApiProperty({ description: 'Current name' }) name: string;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({ enum: reward_status, enumName: 'RewardStatus' })
  status: reward_status;
  @ApiProperty({ description: 'Current cost' }) pointsCost: number;
  @ApiProperty({ description: 'Times given in the period' })
  redemptions: number;
  @ApiProperty({ description: 'Points spent on it in the period' })
  pointsRedeemed: number;
  @ApiProperty({ description: 'Different customer cards that got it' })
  customers: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Customers whose balance covers it now (0 when archived; NULL for a branch manager)',
  })
  canAfford: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: `Customers at ${CLOSE_SHARE * 100}-99% of its cost now (0 when archived; NULL for a branch manager)`,
  })
  close: number | null;
}

class RangeDto {
  @ApiProperty({ example: '2026-09-15' }) from: string;
  @ApiProperty({ example: '2026-10-14' }) to: string;
}

export class VendorRewardPerformanceDto {
  @ApiProperty({ type: RangeDto }) range: RangeDto;
  @ApiProperty({
    type: PointsHeldDto,
    nullable: true,
    description:
      'Balances are merchant-wide, so vendor admin only (NULL for a branch manager)',
  })
  held: PointsHeldDto | null;
  @ApiProperty({
    type: [RewardPerformanceDto],
    description:
      'Active rewards, plus archived ones given in the period; most given first',
  })
  rewards: RewardPerformanceDto[];
  @ApiProperty({ description: 'When these numbers were computed' })
  updatedAt: string;
}

/**
 * How rewards perform: times each was given in a period, how many customers can afford it or
 * are close to it now, and what the points customers hold are worth at the active rule.
 * Counts only, never who the customers are. Blocked customers are left out of the balances.
 * Balances are merchant-wide, so a branch manager gets their branch's redemptions only.
 */
@Injectable()
export class VendorRewardPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    ctx: StaffContext,
    q: VendorRewardPerformanceQueryDto,
  ): Promise<VendorRewardPerformanceDto> {
    const admin = ctx.branchId === null; // merchant-wide: admin or viewer
    const branchId = admin ? q.branchId : ctx.branchId!;
    const where: Prisma.redemptionsWhereInput = {
      vendor_id: ctx.vendorId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(await cairoDays(this.prisma, q.from, q.to)),
    };

    const [given, givenCards, rewards, held, rule] = await Promise.all([
      this.prisma.redemptions.groupBy({
        by: ['reward_id'],
        where,
        _count: { _all: true },
        _sum: { points_cost: true },
      }),
      this.prisma.redemptions.groupBy({ by: ['reward_id', 'card_id'], where }),
      this.balancesPerReward(ctx.vendorId),
      admin ? this.held(ctx.vendorId) : null,
      admin
        ? this.prisma.point_rules.findFirst({
            where: { vendor_id: ctx.vendorId, is_active: true },
            select: { spend_amount: true, points_per_spend: true },
          })
        : null,
    ]);

    const givenBy = new Map(given.map((g) => [g.reward_id, g]));
    const customersBy = new Map<string, number>();
    for (const g of givenCards)
      customersBy.set(g.reward_id, (customersBy.get(g.reward_id) ?? 0) + 1);

    const shown = rewards.filter(
      (r) => r.status === 'active' || givenBy.has(r.id),
    );

    return {
      range: { from: q.from, to: q.to },
      held: held && {
        points: held.points,
        customers: held.customers,
        worth: rule
          ? new Prisma.Decimal(held.points)
              .mul(rule.spend_amount)
              .div(rule.points_per_spend)
              .toFixed(2)
          : null,
        rate: rule
          ? {
              spendAmount: rule.spend_amount.toFixed(2),
              pointsPerSpend: rule.points_per_spend,
            }
          : null,
        readyToRedeem: held.ready,
        closeToReward: held.close,
      },
      rewards: shown
        .map((r) => {
          const g = givenBy.get(r.id);
          return {
            rewardId: r.id,
            name: r.name,
            imageUrl: r.image_url,
            status: r.status,
            pointsCost: r.points_cost,
            redemptions: g?._count._all ?? 0,
            pointsRedeemed: g?._sum.points_cost ?? 0,
            customers: customersBy.get(r.id) ?? 0,
            canAfford: !admin ? null : r.status === 'active' ? r.can_afford : 0,
            close: !admin ? null : r.status === 'active' ? r.close : 0,
          };
        })
        .sort(
          (a, b) =>
            b.redemptions - a.redemptions ||
            a.pointsCost - b.pointsCost ||
            a.name.localeCompare(b.name),
        ),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Every reward with how many (unblocked) customer balances cover it or are close to it. */
  private async balancesPerReward(vendorId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        image_url: string | null;
        status: reward_status;
        points_cost: number;
        can_afford: bigint;
        close: bigint;
      }[]
    >`
      WITH c AS (
        SELECT c.balance FROM cards c JOIN users u ON u.id = c.user_id
        WHERE c.vendor_id = ${vendorId}::uuid AND c.balance > 0 AND u.status = 'active'
      )
      SELECT r.id, r.name, r.image_url, r.status, r.points_cost,
             count(c.balance) FILTER (WHERE c.balance >= r.points_cost) AS can_afford,
             count(c.balance) FILTER (WHERE c.balance < r.points_cost
                                        AND c.balance >= ceil(r.points_cost * ${CLOSE_SHARE}::numeric)) AS close
      FROM rewards r LEFT JOIN c ON true
      WHERE r.vendor_id = ${vendorId}::uuid
      GROUP BY r.id`;
    return rows.map((r) => ({
      ...r,
      can_afford: Number(r.can_afford),
      close: Number(r.close),
    }));
  }

  /** Points held by (unblocked) customers, and how many can redeem now or are close to an active reward. */
  private async held(vendorId: string) {
    const [r] = await this.prisma.$queryRaw<
      {
        points: bigint | null;
        customers: bigint;
        ready: bigint;
        close: bigint;
      }[]
    >`
      WITH c AS (
        SELECT c.balance FROM cards c JOIN users u ON u.id = c.user_id
        WHERE c.vendor_id = ${vendorId}::uuid AND c.balance > 0 AND u.status = 'active'
      ),
      r AS (
        SELECT points_cost FROM rewards
        WHERE vendor_id = ${vendorId}::uuid AND status = 'active'
      )
      SELECT
        (SELECT sum(balance) FROM c)                                            AS points,
        (SELECT count(*) FROM c)                                                AS customers,
        (SELECT count(*) FROM c WHERE balance >= (SELECT min(points_cost) FROM r)) AS ready,
        (SELECT count(*) FROM c WHERE EXISTS (
           SELECT 1 FROM r WHERE c.balance < r.points_cost
                             AND c.balance >= ceil(r.points_cost * ${CLOSE_SHARE}::numeric))) AS close`;
    return {
      points: Number(r.points ?? 0),
      customers: Number(r.customers),
      ready: Number(r.ready),
      close: Number(r.close),
    };
  }
}

@VendorApi('vendor: reward performance')
@Controller('vendor/reward-performance')
export class VendorRewardPerformanceController {
  constructor(private readonly performance: VendorRewardPerformanceService) {}

  /** Per reward: given in the period, customers who can afford it or are close now; and what held points are worth (counts only). */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager', 'viewer')
  @ApiOkResponse({ type: VendorRewardPerformanceDto })
  get(
    @CurrentStaff() ctx: StaffContext,
    @Query() q: VendorRewardPerformanceQueryDto,
  ): Promise<VendorRewardPerformanceDto> {
    return this.performance.get(ctx, q);
  }
}
