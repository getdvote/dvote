import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';

const TZ = 'Africa/Cairo';
const TOP_MEMBERS = 10;
const COHORT_MONTHS = 6;

export class VendorPatternsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Vendor admin only; a branch manager always gets their branch' })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}

class TopMemberDto {
  @ApiProperty({ example: '3B85F1', description: 'First 6 characters of the card id' }) customerRef: string;
  @ApiProperty({ type: String, nullable: true, example: 'Mona Ali' }) name: string | null;
  @ApiProperty({ description: 'Days with a collect, last 365 days' }) visits: number;
  @ApiProperty({ description: 'Points collected, last 365 days' }) points: number;
  @ApiProperty({ description: 'Rewards redeemed, last 365 days' }) rewards: number;
  @ApiProperty({ example: '590.00', description: 'Sum of bills on collects, last 365 days' }) spent: string;
  @ApiProperty({ type: String, format: 'date-time' }) lastSeen: string;
}

class HourCellDto {
  @ApiProperty({ description: '0 = Sunday … 6 = Saturday (Cairo time)' }) day: number;
  @ApiProperty({ description: '0-23 (Cairo time)' }) hour: number;
  @ApiProperty({ description: 'Collects + redemptions in that hour, last 12 weeks' }) count: number;
}

class CohortDto {
  @ApiProperty({ example: '2026-08', description: 'Month of the first collect (Cairo time)' }) month: string;
  @ApiProperty({ description: 'Customers whose first collect was that month' }) size: number;
  @ApiProperty({
    type: [Number],
    nullable: true,
    description: 'Share (0-1) of them who collected again 1…6 months later; null = that month has not happened yet',
  })
  returned: (number | null)[];
}

export class VendorPatternsDto {
  @ApiProperty({ type: [TopMemberDto], description: `Top ${TOP_MEMBERS}: most visit days in the last year, then most spent` })
  topMembers: TopMemberDto[];
  @ApiProperty({ type: [HourCellDto], description: 'Only hours with activity' }) busiestHours: HourCellDto[];
  @ApiProperty({ type: [CohortDto], description: `The last ${COHORT_MONTHS} months, oldest first` }) cohorts: CohortDto[];
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: string;
}

const customerRef = (cardId: string) => cardId.slice(0, 6).toUpperCase();
const n = (x: bigint | number | null) => Number(x ?? 0);

/**
 * Patterns for the Insights page, on fixed windows (not the page's date range): the top members
 * (last year), the busiest hours of the week (last 12 weeks) and who comes back (monthly groups
 * of first-time customers, last 6 months). A branch manager gets their branch only. Names are
 * shown like on the Customers page; no contact details.
 */
@Injectable()
export class VendorPatternsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ctx: StaffContext, q: VendorPatternsQueryDto): Promise<VendorPatternsDto> {
    const v = ctx.vendorId;
    // merchant-wide accounts (admin, viewer) have no branch; branch roles are held to theirs
    const branchId = ctx.branchId ?? q.branchId;
    const branch = branchId ? Prisma.sql`AND e.branch_id = ${branchId}::uuid` : Prisma.empty;

    const [members, hours, cohortRows, [current]] = await Promise.all([
      this.prisma.$queryRaw<
        { card_id: string; name: string | null; visits: bigint; points: bigint | null; rewards: bigint; spent: Prisma.Decimal | null; last_seen: Date }[]
      >`
        SELECT c.id AS card_id, u.name,
               count(DISTINCT (e.created_at AT TIME ZONE ${TZ})::date) FILTER (WHERE e.type = 'earn') AS visits,
               sum(e.delta) FILTER (WHERE e.type = 'earn')            AS points,
               count(*) FILTER (WHERE e.type = 'redeem')              AS rewards,
               sum(e.purchase_amount) FILTER (WHERE e.type = 'earn')  AS spent,
               max(e.created_at)                                       AS last_seen
        FROM point_events e
        JOIN cards c ON c.id = e.card_id
        JOIN users u ON u.id = c.user_id
        WHERE e.vendor_id = ${v}::uuid AND e.type IN ('earn', 'redeem') ${branch}
          AND e.created_at >= now() - interval '365 days'
        GROUP BY c.id, u.name
        ORDER BY visits DESC, spent DESC NULLS LAST, last_seen DESC
        LIMIT ${TOP_MEMBERS}`,
      this.prisma.$queryRaw<{ day: number; hour: number; count: bigint }[]>`
        SELECT extract(dow FROM e.created_at AT TIME ZONE ${TZ})::int  AS day,
               extract(hour FROM e.created_at AT TIME ZONE ${TZ})::int AS hour,
               count(*) AS count
        FROM point_events e
        WHERE e.vendor_id = ${v}::uuid AND e.type IN ('earn', 'redeem') ${branch}
          AND e.created_at >= now() - interval '84 days'
        GROUP BY 1, 2`,
      // k = months between a customer's first collect and a later one (0 = the first month itself)
      this.prisma.$queryRaw<{ cohort: string; k: number; customers: bigint }[]>`
        WITH ev AS (
          SELECT e.card_id, date_trunc('month', e.created_at AT TIME ZONE ${TZ})::date AS m
          FROM point_events e
          WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' ${branch}
        ), first AS (
          SELECT card_id, min(m) AS cohort FROM ev GROUP BY card_id
        )
        SELECT to_char(f.cohort, 'YYYY-MM') AS cohort,
               ((extract(year FROM ev.m) - extract(year FROM f.cohort)) * 12
                 + extract(month FROM ev.m) - extract(month FROM f.cohort))::int AS k,
               count(DISTINCT ev.card_id) AS customers
        FROM first f JOIN ev ON ev.card_id = f.card_id
        WHERE f.cohort >= date_trunc('month', now() AT TIME ZONE ${TZ})::date - make_interval(months => ${COHORT_MONTHS - 1})
        GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ month: string }[]>`SELECT to_char(now() AT TIME ZONE ${TZ}, 'YYYY-MM') AS month`,
    ]);

    // the last COHORT_MONTHS months, oldest first, empty ones included
    const [cy, cm] = current.month.split('-').map(Number);
    const index = (month: string) => {
      const [y, m] = month.split('-').map(Number);
      return y * 12 + m - 1;
    };
    const now = cy * 12 + cm - 1;
    const cohorts: CohortDto[] = [];
    for (let i = COHORT_MONTHS - 1; i >= 0; i--) {
      const at = now - i;
      const month = `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
      const rows = cohortRows.filter((r) => r.cohort === month);
      const size = n(rows.find((r) => r.k === 0)?.customers ?? 0);
      const returned = Array.from({ length: COHORT_MONTHS }, (_, j) => {
        const k = j + 1;
        if (index(month) + k > now) return null;
        return size ? n(rows.find((r) => r.k === k)?.customers ?? 0) / size : 0;
      });
      cohorts.push({ month, size, returned });
    }

    return {
      topMembers: members.map((m) => ({
        customerRef: customerRef(m.card_id),
        name: m.name,
        visits: n(m.visits),
        points: n(m.points),
        rewards: n(m.rewards),
        spent: (m.spent ?? new Prisma.Decimal(0)).toFixed(2),
        lastSeen: m.last_seen.toISOString(),
      })),
      busiestHours: hours.map((h) => ({ day: h.day, hour: h.hour, count: n(h.count) })),
      cohorts,
      updatedAt: new Date().toISOString(),
    };
  }
}

@VendorApi('vendor: insights')
@Controller('vendor/insights/patterns')
export class VendorPatternsController {
  constructor(private readonly patterns: VendorPatternsService) {}

  /** Top members, busiest hours, who comes back (fixed windows, not the page's date range). */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager', 'viewer')
  @ApiOkResponse({ type: VendorPatternsDto })
  get(@CurrentStaff() ctx: StaffContext, @Query() q: VendorPatternsQueryDto): Promise<VendorPatternsDto> {
    return this.patterns.get(ctx, q);
  }
}
