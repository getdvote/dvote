import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';
import { cairoDays, IsDay } from './cairo-days';

const TZ = 'Africa/Cairo';
const MAX_DAYS = 366;
const DAY_MS = 86_400_000;

export class VendorInsightsQueryDto {
  @ApiProperty({
    example: '2026-09-11',
    description: 'First day, Cairo time (inclusive)',
  })
  @IsDay()
  from: string;

  @ApiProperty({
    example: '2026-10-10',
    description: 'Last day, Cairo time (inclusive); at most 366 days',
  })
  @IsDay()
  to: string;

  @ApiPropertyOptional({
    enum: ['previous', 'none'],
    default: 'previous',
    description: 'previous = the same number of days just before',
  })
  @IsOptional()
  @IsIn(['previous', 'none'])
  compare?: 'previous' | 'none';

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for a branch manager (always their branch)',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}

class InsightsKpisDto {
  @ApiProperty({ example: '12500.00', description: 'Sum of bills on collects' })
  sales: string;
  @ApiProperty({ description: 'Collects (one visit = one bill scanned)' })
  visits: number;
  @ApiProperty({
    example: '125.00',
    description: 'sales / visits; "0.00" without visits',
  })
  avgBill: string;
  @ApiProperty({ description: 'Different customer cards that collected' })
  customers: number;
  @ApiProperty({
    description: 'Customers whose first ever collect here was in the period',
  })
  newCustomers: number;
  @ApiProperty({ description: 'Customers with 2+ visits in the period' })
  returningCustomers: number;
  @ApiProperty({
    example: 0.42,
    description: 'returningCustomers / customers (0-1); 0 without customers',
  })
  repeatRate: number;
  @ApiProperty({ example: 1.8, description: 'visits / customers' })
  visitsPerCustomer: number;
  @ApiProperty({
    description: 'Different customer cards that redeemed a reward',
  })
  redeemingCustomers: number;
  @ApiProperty() rewardsRedeemed: number;
  @ApiProperty() pointsGiven: number;
  @ApiProperty() pointsRedeemed: number;
}

class InsightsDayDto {
  @ApiProperty({ example: '2026-10-01' }) date: string;
  @ApiProperty({ example: '420.00' }) sales: string;
  @ApiProperty() visits: number;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Same position in the comparison period',
  })
  previousSales: string | null;
  @ApiProperty({ type: Number, nullable: true }) previousVisits: number | null;
}

class InsightsBranchDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() sales: string;
  @ApiProperty() visits: number;
  @ApiProperty() customers: number;
  @ApiProperty() avgBill: string;
}

class InsightsRangeDto {
  @ApiProperty({ example: '2026-09-11' }) from: string;
  @ApiProperty({ example: '2026-10-10' }) to: string;
}

export class VendorInsightsDto {
  @ApiProperty({ type: InsightsRangeDto }) range: InsightsRangeDto;
  @ApiProperty({ type: InsightsRangeDto, nullable: true })
  previousRange: InsightsRangeDto | null;
  @ApiProperty({ type: InsightsKpisDto }) current: InsightsKpisDto;
  @ApiProperty({ type: InsightsKpisDto, nullable: true })
  previous: InsightsKpisDto | null;
  @ApiProperty({ type: [InsightsDayDto] }) days: InsightsDayDto[];
  @ApiProperty({
    type: [InsightsBranchDto],
    description: 'Vendor admin only (empty for a branch manager)',
  })
  branches: InsightsBranchDto[];
  @ApiProperty({ description: 'When these numbers were computed' })
  updatedAt: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) =>
  iso(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
const money = (v: Prisma.Decimal | string | null) =>
  new Prisma.Decimal(v ?? 0).toFixed(2);

/**
 * Loyalty performance for a period (Cairo days) and the same number of days before it: sales
 * through dvote, visits, average bill, customers (new / returning), redemptions. Counts only,
 * never who the customers are. A branch manager sees their branch.
 */
@Injectable()
export class VendorInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    ctx: StaffContext,
    q: VendorInsightsQueryDto,
  ): Promise<VendorInsightsDto> {
    const days =
      Math.round((Date.parse(q.to) - Date.parse(q.from)) / DAY_MS) + 1;
    if (days < 1) throw new BadRequestException({ code: 'range_invalid' });
    if (days > MAX_DAYS)
      throw new BadRequestException({ code: 'range_too_long' });
    const branchId = ctx.role === 'vendor_admin' ? q.branchId : ctx.branchId!;
    const range = { from: q.from, to: q.to };
    const previousRange =
      q.compare === 'none'
        ? null
        : { from: addDays(q.from, -days), to: addDays(q.from, -1) };

    const [current, previous, curDays, prevDays, branches] = await Promise.all([
      this.kpis(ctx.vendorId, branchId, range),
      previousRange ? this.kpis(ctx.vendorId, branchId, previousRange) : null,
      this.daily(ctx.vendorId, branchId, range),
      previousRange ? this.daily(ctx.vendorId, branchId, previousRange) : null,
      ctx.role === 'vendor_admin' && !branchId
        ? this.byBranch(ctx.vendorId, range)
        : [],
    ]);

    return {
      range,
      previousRange,
      current,
      previous,
      days: curDays.map((d, i) => ({
        ...d,
        previousSales: prevDays ? prevDays[i].sales : null,
        previousVisits: prevDays ? prevDays[i].visits : null,
      })),
      branches,
      updatedAt: new Date().toISOString(),
    };
  }

  private async bounds(range: { from: string; to: string }) {
    const { created_at } = await cairoDays(this.prisma, range.from, range.to);
    return { start: created_at!.gte as Date, end: created_at!.lt as Date };
  }

  private async kpis(
    vendorId: string,
    branchId: string | undefined,
    range: { from: string; to: string },
  ): Promise<InsightsKpisDto> {
    const { start, end } = await this.bounds(range);
    const branch = branchId
      ? Prisma.sql`AND branch_id = ${branchId}::uuid`
      : Prisma.empty;
    const [r] = await this.prisma.$queryRaw<
      {
        sales: Prisma.Decimal | null;
        visits: bigint;
        customers: bigint;
        returning: bigint;
        points_given: bigint | null;
        points_redeemed: bigint | null;
        rewards: bigint;
        redeeming: bigint;
        new_customers: bigint;
      }[]
    >`
      WITH e AS (
        SELECT card_id, type, delta, purchase_amount FROM point_events
        WHERE vendor_id = ${vendorId}::uuid AND created_at >= ${start} AND created_at < ${end} ${branch}
      ),
      per_card AS (SELECT card_id, count(*) AS n FROM e WHERE type = 'earn' GROUP BY card_id),
      first_visit AS (
        SELECT DISTINCT ON (card_id) card_id, branch_id, created_at FROM point_events
        WHERE vendor_id = ${vendorId}::uuid AND type = 'earn'
        ORDER BY card_id, created_at
      )
      SELECT
        (SELECT sum(purchase_amount) FROM e WHERE type = 'earn')               AS sales,
        (SELECT count(*) FROM e WHERE type = 'earn')                           AS visits,
        (SELECT count(*) FROM per_card)                                        AS customers,
        (SELECT count(*) FROM per_card WHERE n >= 2)                           AS returning,
        (SELECT sum(delta) FROM e WHERE type = 'earn')                         AS points_given,
        (SELECT -sum(delta) FROM e WHERE type = 'redeem')                      AS points_redeemed,
        (SELECT count(*) FROM e WHERE type = 'redeem')                         AS rewards,
        (SELECT count(DISTINCT card_id) FROM e WHERE type = 'redeem')          AS redeeming,
        (SELECT count(*) FROM first_visit f
           WHERE f.created_at >= ${start} AND f.created_at < ${end}
           ${branchId ? Prisma.sql`AND f.branch_id = ${branchId}::uuid` : Prisma.empty}) AS new_customers`;

    const sales = new Prisma.Decimal(r.sales ?? 0);
    const visits = Number(r.visits);
    const customers = Number(r.customers);
    const returning = Number(r.returning);
    return {
      sales: sales.toFixed(2),
      visits,
      avgBill: visits ? sales.div(visits).toFixed(2) : '0.00',
      customers,
      newCustomers: Number(r.new_customers),
      returningCustomers: returning,
      repeatRate: customers
        ? Math.round((returning / customers) * 1000) / 1000
        : 0,
      visitsPerCustomer: customers
        ? Math.round((visits / customers) * 100) / 100
        : 0,
      redeemingCustomers: Number(r.redeeming),
      rewardsRedeemed: Number(r.rewards),
      pointsGiven: Number(r.points_given ?? 0),
      pointsRedeemed: Number(r.points_redeemed ?? 0),
    };
  }

  /** One row per Cairo day of the range, oldest first, zeros included. */
  private async daily(
    vendorId: string,
    branchId: string | undefined,
    range: { from: string; to: string },
  ) {
    const branch = branchId
      ? Prisma.sql`AND e.branch_id = ${branchId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { day: string; sales: Prisma.Decimal | null; visits: bigint }[]
    >`
      WITH d AS (SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS day)
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day, sum(e.purchase_amount) AS sales, count(e.id) AS visits
      FROM d
      LEFT JOIN point_events e
        ON e.vendor_id = ${vendorId}::uuid AND e.type = 'earn' ${branch}
       AND e.created_at >= (d.day::timestamp AT TIME ZONE ${TZ})
       AND e.created_at <  ((d.day + 1)::timestamp AT TIME ZONE ${TZ})
      GROUP BY d.day ORDER BY d.day`;
    return rows.map((r) => ({
      date: r.day,
      sales: money(r.sales),
      visits: Number(r.visits),
    }));
  }

  private async byBranch(
    vendorId: string,
    range: { from: string; to: string },
  ): Promise<InsightsBranchDto[]> {
    const { start, end } = await this.bounds(range);
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        sales: Prisma.Decimal | null;
        visits: bigint;
        customers: bigint;
      }[]
    >`
      SELECT b.id, b.name, sum(e.purchase_amount) AS sales, count(e.id) AS visits, count(DISTINCT e.card_id) AS customers
      FROM branches b
      LEFT JOIN point_events e ON e.branch_id = b.id AND e.type = 'earn' AND e.created_at >= ${start} AND e.created_at < ${end}
      WHERE b.vendor_id = ${vendorId}::uuid AND (b.status = 'active' OR e.id IS NOT NULL)
      GROUP BY b.id, b.name
      ORDER BY sales DESC NULLS LAST, b.name`;
    return rows.map((r) => {
      const visits = Number(r.visits);
      const sales = new Prisma.Decimal(r.sales ?? 0);
      return {
        id: r.id,
        name: r.name,
        sales: sales.toFixed(2),
        visits,
        customers: Number(r.customers),
        avgBill: visits ? sales.div(visits).toFixed(2) : '0.00',
      };
    });
  }
}

@VendorApi('vendor: insights')
@Controller('vendor/insights')
export class VendorInsightsController {
  constructor(private readonly insights: VendorInsightsService) {}

  /** Loyalty performance for a period vs the one before (counts only, no customer data). */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: VendorInsightsDto })
  get(
    @CurrentStaff() ctx: StaffContext,
    @Query() q: VendorInsightsQueryDto,
  ): Promise<VendorInsightsDto> {
    return this.insights.get(ctx, q);
  }
}
