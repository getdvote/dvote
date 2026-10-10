import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { Prisma } from '../generated/prisma/client.js';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { VendorActivityController, VendorActivityService } from './vendor-activity';
import { VendorAttentionController, VendorAttentionService } from './vendor-attention';
import { VendorInsightsController, VendorInsightsService } from './vendor-insights';
import { VendorRedemptionsController, VendorRedemptionsService } from './vendor-redemptions';

const TZ = 'Africa/Cairo';

class SummaryDayDto {
  @ApiProperty({ example: '2026-10-09' }) date: string;
  @ApiProperty() pointsEarned: number;
  @ApiProperty() collects: number;
}

class SummaryBranchDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'Last 30 days' }) collects: number;
  @ApiProperty({ description: 'Last 30 days' }) pointsEarned: number;
}

/** The vendor dashboard's home. Counts only: vendors never see who their customers are. */
export class VendorSummaryResponseDto {
  @ApiProperty({ description: 'Collects today (Cairo time)' }) collectsToday: number;
  @ApiProperty() pointsToday: number;
  @ApiProperty({ description: 'Customers with a card here (whole vendor)' }) customers: number;
  @ApiProperty({ description: 'New cards in the last 7 days' }) newCustomers7d: number;
  @ApiProperty() pointsEarned30d: number;
  @ApiProperty() pointsRedeemed30d: number;
  @ApiProperty({ description: 'Points customers hold here right now' }) pointsOutstanding: number;
  @ApiProperty({ type: [SummaryDayDto], description: '14 days, oldest first' }) days: SummaryDayDto[];
  @ApiProperty({ type: [SummaryBranchDto] }) branches: SummaryBranchDto[];
}

@Injectable()
export class VendorSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Activity numbers for my vendor; a branch manager's activity numbers cover their branch only. */
  async summary(ctx: StaffContext): Promise<VendorSummaryResponseDto> {
    const v = ctx.vendorId;
    const branchOnly = ctx.role === 'vendor_admin' ? Prisma.empty : Prisma.sql`AND e.branch_id = ${ctx.branchId}::uuid`;

    const [c] = await this.prisma.$queryRaw<
      {
        collects_today: bigint;
        points_today: bigint | null;
        customers: bigint;
        new7d: bigint;
        earned30: bigint | null;
        redeemed30: bigint | null;
        outstanding: bigint | null;
      }[]
    >`
      SELECT
        (SELECT count(*) FROM point_events e WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' ${branchOnly}
           AND (e.created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date)        AS collects_today,
        (SELECT sum(delta) FROM point_events e WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' ${branchOnly}
           AND (e.created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date)        AS points_today,
        (SELECT count(*) FROM cards WHERE vendor_id = ${v}::uuid)                                   AS customers,
        (SELECT count(*) FROM cards WHERE vendor_id = ${v}::uuid AND created_at >= now() - interval '7 days') AS new7d,
        (SELECT sum(delta) FROM point_events e WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' ${branchOnly}
           AND e.created_at >= now() - interval '30 days')                                          AS earned30,
        (SELECT -sum(delta) FROM point_events e WHERE e.vendor_id = ${v}::uuid AND e.type = 'redeem' ${branchOnly}
           AND e.created_at >= now() - interval '30 days')                                          AS redeemed30,
        (SELECT sum(balance) FROM cards WHERE vendor_id = ${v}::uuid)                               AS outstanding`;

    const days = await this.prisma.$queryRaw<{ day: string; points: bigint | null; collects: bigint }[]>`
      WITH d AS (
        SELECT generate_series((now() AT TIME ZONE ${TZ})::date - 13, (now() AT TIME ZONE ${TZ})::date, interval '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             (SELECT sum(delta) FROM point_events e WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' ${branchOnly}
                AND (e.created_at AT TIME ZONE ${TZ})::date = d.day) AS points,
             (SELECT count(*) FROM point_events e WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' ${branchOnly}
                AND (e.created_at AT TIME ZONE ${TZ})::date = d.day) AS collects
      FROM d ORDER BY d.day`;

    const branches = await this.prisma.$queryRaw<{ id: string; name: string; collects: bigint; points: bigint | null }[]>`
      SELECT b.id, b.name,
             count(e.id) AS collects,
             sum(e.delta) AS points
      FROM branches b
      LEFT JOIN point_events e ON e.branch_id = b.id AND e.type = 'earn' AND e.created_at >= now() - interval '30 days'
      WHERE b.vendor_id = ${v}::uuid AND b.status = 'active'
        ${ctx.role === 'vendor_admin' ? Prisma.empty : Prisma.sql`AND b.id = ${ctx.branchId}::uuid`}
      GROUP BY b.id, b.name
      ORDER BY points DESC NULLS LAST, b.name`;

    const n = (x: bigint | null) => Number(x ?? 0);
    return {
      collectsToday: n(c.collects_today),
      pointsToday: n(c.points_today),
      customers: n(c.customers),
      newCustomers7d: n(c.new7d),
      pointsEarned30d: n(c.earned30),
      pointsRedeemed30d: n(c.redeemed30),
      pointsOutstanding: n(c.outstanding),
      days: days.map((d) => ({ date: d.day, pointsEarned: n(d.points), collects: n(d.collects) })),
      branches: branches.map((b) => ({ id: b.id, name: b.name, collects: n(b.collects), pointsEarned: n(b.points) })),
    };
  }
}

@VendorApi('vendor: summary')
@Controller('vendor/summary')
export class VendorSummaryController {
  constructor(private readonly reports: VendorSummaryService) {}

  /** Dashboard home: today, the last 14 days, branches (counts only, no customer data). */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: VendorSummaryResponseDto })
  summary(@CurrentStaff() ctx: StaffContext): Promise<VendorSummaryResponseDto> {
    return this.reports.summary(ctx);
  }
}

/** Reports for the vendor dashboard (/api/vendor/summary, /api/vendor/events, /api/vendor/redemptions, /api/vendor/attention, /api/vendor/insights). */
@Module({
  imports: [AuthModule],
  controllers: [VendorSummaryController, VendorActivityController, VendorRedemptionsController, VendorAttentionController, VendorInsightsController],
  providers: [VendorSummaryService, VendorActivityService, VendorRedemptionsService, VendorAttentionService, VendorInsightsService],
})
export class ReportsModule {}
