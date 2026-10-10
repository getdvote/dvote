import { Controller, Get, Injectable, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Prisma, point_event_type } from '../generated/prisma/client.js';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';
import { cairoDays, IsDay } from './cairo-days';

export class VendorActivityQueryDto {
  @ApiPropertyOptional({ enum: point_event_type, enumName: 'PointEventType' })
  @IsOptional()
  @IsIn(Object.values(point_event_type))
  type?: point_event_type;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for a branch manager (always their branch)',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Who scanned' })
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

  @ApiPropertyOptional({ description: 'Part of a receipt number' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  receipt?: string;

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

class ActivityRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

class ActivityItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: point_event_type, enumName: 'PointEventType' })
  type: point_event_type;
  @ApiProperty({ description: '+ earned, − redeemed or removed' })
  points: number;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Bill (earn only), e.g. "95.00"',
  })
  amount: string | null;
  @ApiProperty({ type: String, nullable: true }) receiptRef: string | null;
  @ApiProperty({ type: ActivityRefDto, nullable: true })
  branch: ActivityRefDto | null;
  @ApiProperty({
    type: ActivityRefDto,
    nullable: true,
    description: 'Who scanned',
  })
  staff: ActivityRefDto | null;
  @ApiProperty({
    type: ActivityRefDto,
    nullable: true,
    description: 'Redeem: the reward as it was when given',
  })
  reward: ActivityRefDto | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Adjust: why dvote corrected the points',
  })
  reason: string | null;
  @ApiProperty({
    description:
      'Short code for the customer’s card here (not who they are), to spot repeat visits',
  })
  customerRef: string;
  @ApiProperty() createdAt: string;
}

class ActivityTotalsDto {
  @ApiProperty() collects: number;
  @ApiProperty() redemptions: number;
  @ApiProperty() pointsEarned: number;
  @ApiProperty() pointsRedeemed: number;
  @ApiProperty({ example: '1250.00', description: 'Sum of bills on collects' })
  sales: string;
}

export class VendorActivityDto {
  @ApiProperty({ type: [ActivityItemDto] }) items: ActivityItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({
    type: ActivityTotalsDto,
    description: 'For every row matching the filters, not just this page',
  })
  totals: ActivityTotalsDto;
}

/** The card id says nothing about the customer; its first 6 characters tell visits apart. */
const customerRef = (cardId: string) => cardId.slice(0, 6).toUpperCase();

@Injectable()
export class VendorActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** My vendor's ledger, newest first. A branch manager sees their branch only. */
  async list(
    ctx: StaffContext,
    q: VendorActivityQueryDto,
  ): Promise<VendorActivityDto> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const branchId = ctx.role === 'vendor_admin' ? q.branchId : ctx.branchId!;

    const days = await cairoDays(this.prisma, q.from, q.to);

    const where: Prisma.point_eventsWhereInput = {
      vendor_id: ctx.vendorId,
      ...(q.type ? { type: q.type } : {}),
      ...(branchId ? { branch_id: branchId } : {}),
      ...(q.staffId ? { staff_id: q.staffId } : {}),
      ...(q.receipt?.trim()
        ? { receipt_ref: { contains: q.receipt.trim(), mode: 'insensitive' } }
        : {}),
      ...days,
    };

    const [rows, total, groups] = await Promise.all([
      this.prisma.point_events.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          branches: { select: { id: true, name: true } },
          staff_users: { select: { id: true, name: true } },
          redemptions: { select: { reward_id: true, reward_name: true } },
        },
      }),
      this.prisma.point_events.count({ where }),
      this.prisma.point_events.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
        _sum: { delta: true, purchase_amount: true },
      }),
    ]);

    const earn = groups.find((g) => g.type === 'earn');
    const redeem = groups.find((g) => g.type === 'redeem');
    return {
      items: rows.map((e) => ({
        id: e.id,
        type: e.type,
        points: e.delta,
        amount: e.purchase_amount ? e.purchase_amount.toFixed(2) : null,
        receiptRef: e.receipt_ref,
        branch: e.branches
          ? { id: e.branches.id, name: e.branches.name }
          : null,
        staff: e.staff_users
          ? { id: e.staff_users.id, name: e.staff_users.name }
          : null,
        reward: e.redemptions
          ? { id: e.redemptions.reward_id, name: e.redemptions.reward_name }
          : null,
        reason: e.reason,
        customerRef: customerRef(e.card_id),
        createdAt: e.created_at.toISOString(),
      })),
      total,
      page,
      pageSize,
      totals: {
        collects: earn?._count._all ?? 0,
        redemptions: redeem?._count._all ?? 0,
        pointsEarned: earn?._sum.delta ?? 0,
        pointsRedeemed: -(redeem?._sum.delta ?? 0),
        sales: (earn?._sum.purchase_amount ?? new Prisma.Decimal(0)).toFixed(2),
      },
    };
  }
}

@VendorApi('vendor: events')
@Controller('vendor/events')
export class VendorActivityController {
  constructor(private readonly activity: VendorActivityService) {}

  /** Every collect, redemption and correction at my shops, newest first (no customer names). */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: VendorActivityDto })
  list(
    @CurrentStaff() ctx: StaffContext,
    @Query() q: VendorActivityQueryDto,
  ): Promise<VendorActivityDto> {
    return this.activity.list(ctx, q);
  }
}
