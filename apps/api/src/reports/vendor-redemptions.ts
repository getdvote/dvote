import { Controller, Get, Injectable, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Prisma, reward_status } from '../generated/prisma/client.js';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';
import { cairoDays, IsDay } from './cairo-days';

export class VendorRedemptionsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUuid()
  rewardId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for a branch manager (always their branch)',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Who gave the reward' })
  @IsOptional()
  @IsUuid()
  staffId?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'First day, Cairo time (inclusive)',
  })
  @IsOptional()
  @IsDay()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-10',
    description: 'Last day, Cairo time (inclusive)',
  })
  @IsOptional()
  @IsDay()
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

class RefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

class RedemptionItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) rewardId: string;
  @ApiProperty({
    description: 'The reward’s name when it was given (snapshot)',
  })
  rewardName: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The reward’s current photo',
  })
  imageUrl: string | null;
  @ApiProperty({ description: 'Points it cost then (snapshot)' })
  pointsCost: number;
  @ApiProperty({ type: RefDto }) branch: RefDto;
  @ApiProperty({ type: RefDto, description: 'Who gave it' }) staff: RefDto;
  @ApiProperty({
    description: 'Short code for the customer’s card here (not who they are)',
  })
  customerRef: string;
  @ApiProperty() createdAt: string;
}

class RewardBreakdownDto {
  @ApiProperty({ format: 'uuid' }) rewardId: string;
  @ApiProperty({ description: 'Current name' }) name: string;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({ enum: reward_status, enumName: 'RewardStatus' })
  status: reward_status;
  @ApiProperty() count: number;
  @ApiProperty() points: number;
}

class RedemptionTotalsDto {
  @ApiProperty() redemptions: number;
  @ApiProperty() points: number;
  @ApiProperty({ description: 'Different customer cards' }) customers: number;
}

export class VendorRedemptionsDto {
  @ApiProperty({ type: [RedemptionItemDto] }) items: RedemptionItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({
    type: RedemptionTotalsDto,
    description: 'Every row matching the filters',
  })
  totals: RedemptionTotalsDto;
  @ApiProperty({
    type: [RewardBreakdownDto],
    description:
      'Per reward for the period, branch and staff filters (not the reward filter), most given first',
  })
  byReward: RewardBreakdownDto[];
}

@Injectable()
export class VendorRedemptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rewards given at my shops, newest first. A branch manager sees their branch only. */
  async list(
    ctx: StaffContext,
    q: VendorRedemptionsQueryDto,
  ): Promise<VendorRedemptionsDto> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const branchId = ctx.role === 'vendor_admin' ? q.branchId : ctx.branchId!;

    // The breakdown ignores the reward filter so it can be used to pick one.
    const base: Prisma.redemptionsWhereInput = {
      vendor_id: ctx.vendorId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(q.staffId ? { staff_id: q.staffId } : {}),
      ...(await cairoDays(this.prisma, q.from, q.to)),
    };
    const where: Prisma.redemptionsWhereInput = {
      ...base,
      ...(q.rewardId ? { reward_id: q.rewardId } : {}),
    };

    const [rows, sums, cards, perReward] = await Promise.all([
      this.prisma.redemptions.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          branches: { select: { id: true, name: true } },
          staff_users: { select: { id: true, name: true } },
          rewards: { select: { image_url: true } },
        },
      }),
      this.prisma.redemptions.aggregate({
        where,
        _count: { _all: true },
        _sum: { points_cost: true },
      }),
      this.prisma.redemptions.groupBy({ by: ['card_id'], where }),
      this.prisma.redemptions.groupBy({
        by: ['reward_id'],
        where: base,
        _count: { _all: true },
        _sum: { points_cost: true },
      }),
    ]);

    const rewards = await this.prisma.rewards.findMany({
      where: {
        vendor_id: ctx.vendorId,
        id: { in: perReward.map((r) => r.reward_id) },
      },
      select: { id: true, name: true, image_url: true, status: true },
    });
    const reward = new Map(rewards.map((r) => [r.id, r]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        rewardId: r.reward_id,
        rewardName: r.reward_name,
        imageUrl: r.rewards.image_url,
        pointsCost: r.points_cost,
        branch: r.branches,
        staff: r.staff_users,
        customerRef: r.card_id.slice(0, 6).toUpperCase(),
        createdAt: r.created_at.toISOString(),
      })),
      total: sums._count._all,
      page,
      pageSize,
      totals: {
        redemptions: sums._count._all,
        points: sums._sum.points_cost ?? 0,
        customers: cards.length,
      },
      byReward: perReward
        .map((g) => {
          const r = reward.get(g.reward_id)!;
          return {
            rewardId: g.reward_id,
            name: r.name,
            imageUrl: r.image_url,
            status: r.status,
            count: g._count._all,
            points: g._sum.points_cost ?? 0,
          };
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  }
}

@VendorApi('vendor: redemptions')
@Controller('vendor/redemptions')
export class VendorRedemptionsController {
  constructor(private readonly redemptions: VendorRedemptionsService) {}

  /** Rewards given at my shops: the list, totals and a per-reward breakdown (no customer names). */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: VendorRedemptionsDto })
  list(
    @CurrentStaff() ctx: StaffContext,
    @Query() q: VendorRedemptionsQueryDto,
  ): Promise<VendorRedemptionsDto> {
    return this.redemptions.list(ctx, q);
  }
}
