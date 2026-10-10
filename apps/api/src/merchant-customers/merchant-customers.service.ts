import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerListQuery,
  CustomerScopeQuery,
  CustomerSegment,
  SEGMENTS,
  MerchantCustomerDto,
  MerchantCustomerListDto,
  MerchantCustomerDetailDto,
} from './customer.dto';

type CustomerRow = {
  id: string;
  name: string | null;
  segment: CustomerSegment;
  balance: number | null;
  first_visit: Date | null;
  last_visit: Date | null;
  visits: bigint;
  visits90: bigint;
  spend: Prisma.Decimal;
  redemptions: bigint;
  as_of: string;
};

const money = (n: Prisma.Decimal | string | null) =>
  new Prisma.Decimal(n ?? 0).toFixed(2);
const mapCustomer = (r: CustomerRow): MerchantCustomerDto => ({
  id: r.id,
  reference: r.id.slice(0, 8).toUpperCase(),
  name: r.name,
  segment: r.segment,
  firstVisitAt: r.first_visit?.toISOString() ?? null,
  lastVisitAt: r.last_visit?.toISOString() ?? null,
  visits: Number(r.visits),
  visits90d: Number(r.visits90),
  spend: money(r.spend),
  averageBill: Number(r.visits)
    ? new Prisma.Decimal(r.spend).div(Number(r.visits)).toFixed(2)
    : '0.00',
  rewardsRedeemed: Number(r.redemptions),
  pointsBalance: r.balance,
});

@Injectable()
export class MerchantCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private branch(ctx: StaffContext, requested?: string) {
    return ctx.role === 'vendor_admin' ? requested : ctx.branchId!;
  }

  /** One shared classification for counts, filtering and profiles. All intervals use Cairo days.
   * At-risk wins, then new, regular, returning. Each card belongs to exactly one segment.
   * Branch scope includes only cards with events there, and never exposes other-branch totals.
   */
  private roster(vendorId: string, branchId?: string, cardId?: string) {
    return Prisma.sql`
      WITH clock AS (SELECT (now() AT TIME ZONE 'Africa/Cairo')::date AS today),
      activity AS (
        SELECT e.card_id, min(e.created_at) FILTER (WHERE e.type = 'earn') AS first_visit,
          max(e.created_at) FILTER (WHERE e.type = 'earn') AS last_visit,
          count(*) FILTER (WHERE e.type = 'earn') AS visits,
          count(*) FILTER (WHERE e.type = 'earn' AND e.created_at >=
            ((clock.today - 89)::timestamp AT TIME ZONE 'Africa/Cairo')) AS visits90,
          coalesce(sum(e.purchase_amount) FILTER (WHERE e.type = 'earn'), 0) AS spend,
          count(*) FILTER (WHERE e.type = 'redeem') AS redemptions
        FROM point_events e CROSS JOIN clock
        WHERE e.vendor_id = ${vendorId}::uuid AND e.created_at <= now()
          ${branchId ? Prisma.sql`AND e.branch_id = ${branchId}::uuid` : Prisma.empty}
          ${cardId ? Prisma.sql`AND e.card_id = ${cardId}::uuid` : Prisma.empty}
        GROUP BY e.card_id
      ), roster AS (
        SELECT c.id, u.name, ${branchId ? Prisma.sql`NULL::integer` : Prisma.sql`c.balance`} AS balance,
          a.first_visit, a.last_visit, coalesce(a.visits, 0) AS visits,
          coalesce(a.visits90, 0) AS visits90, coalesce(a.spend, 0) AS spend,
          coalesce(a.redemptions, 0) AS redemptions, to_char(clock.today, 'YYYY-MM-DD') AS as_of,
          CASE
            WHEN a.first_visit IS NULL THEN 'no_visits'
            WHEN (a.last_visit AT TIME ZONE 'Africa/Cairo')::date < clock.today - 29 THEN 'at_risk'
            WHEN (a.first_visit AT TIME ZONE 'Africa/Cairo')::date >= clock.today - 29 THEN 'new'
            WHEN a.visits90 >= 5 THEN 'regular'
            ELSE 'returning'
          END AS segment
        FROM cards c JOIN users u ON u.id = c.user_id CROSS JOIN clock
        LEFT JOIN activity a ON a.card_id = c.id
        WHERE c.vendor_id = ${vendorId}::uuid
          ${branchId ? Prisma.sql`AND a.card_id IS NOT NULL` : Prisma.empty}
          ${cardId ? Prisma.sql`AND c.id = ${cardId}::uuid` : Prisma.empty}
      )`;
  }

  async list(
    ctx: StaffContext,
    q: CustomerListQuery,
  ): Promise<MerchantCustomerListDto> {
    const branchId = this.branch(ctx, q.branchId);
    const roster = this.roster(ctx.vendorId, branchId);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const search = q.search?.trim().replace(/^#/, '') ?? '';
    // strpos makes %, _ and quotes literal; no email/phone lookup or wildcard search.
    const where = Prisma.sql`WHERE true
      ${
        search
          ? Prisma.sql`AND (strpos(lower(coalesce(name, '')), lower(${search})) > 0 OR
        strpos(upper(left(id::text, 8)), upper(${search})) > 0)`
          : Prisma.empty
      }
      ${q.segment ? Prisma.sql`AND segment = ${q.segment}` : Prisma.empty}`;
    const order = {
      recent: Prisma.sql`last_visit DESC NULLS LAST, id`,
      spend: Prisma.sql`spend DESC, id`,
      visits: Prisma.sql`visits DESC, id`,
      name: Prisma.sql`lower(name) ASC NULLS LAST, id`,
    }[q.sort ?? 'recent'];
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          CustomerRow[]
        >`${roster} SELECT * FROM roster ${where}
        ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
        const [total] = await tx.$queryRaw<
          { n: bigint }[]
        >`${roster} SELECT count(*) AS n FROM roster ${where}`;
        const counts = await tx.$queryRaw<
          { segment: CustomerSegment; n: bigint }[]
        >`
        ${roster} SELECT segment, count(*) AS n FROM roster GROUP BY segment`;
        const [clock] = await tx.$queryRaw<
          { day: string }[]
        >`SELECT to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS day`;
        return {
          items: rows.map(mapCustomer),
          total: Number(total.n),
          page,
          pageSize,
          customersTotal: counts.reduce((n, c) => n + Number(c.n), 0),
          segments: SEGMENTS.map((key) => ({
            key,
            count: Number(counts.find((c) => c.segment === key)?.n ?? 0),
          })),
          asOf: clock.day,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async detail(
    ctx: StaffContext,
    cardId: string,
    q: CustomerScopeQuery,
  ): Promise<MerchantCustomerDetailDto> {
    const branchId = this.branch(ctx, q.branchId);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    return this.prisma.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<
          CustomerRow[]
        >`${this.roster(ctx.vendorId, branchId, cardId)} SELECT * FROM roster`;
        if (!row) throw new NotFoundException({ code: 'customer_not_found' });
        const where: Prisma.point_eventsWhereInput = {
          vendor_id: ctx.vendorId,
          card_id: cardId,
          ...(branchId ? { branch_id: branchId } : {}),
          created_at: { lte: new Date() },
        };
        const events = await tx.point_events.findMany({
          where,
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            type: true,
            delta: true,
            purchase_amount: true,
            created_at: true,
            branches: { select: { name: true } },
            redemptions: { select: { reward_name: true } },
          },
        });
        return {
          customer: mapCustomer(row),
          asOf: row.as_of,
          page,
          pageSize,
          total: await tx.point_events.count({ where }),
          // Free-text correction reasons and receipts are deliberately excluded.
          events: events.map((e) => ({
            id: e.id,
            type: e.type,
            points: e.delta,
            amount:
              e.purchase_amount === null ? null : money(e.purchase_amount),
            branchName: e.branches?.name ?? null,
            rewardName: e.redemptions?.reward_name ?? null,
            createdAt: e.created_at.toISOString(),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
