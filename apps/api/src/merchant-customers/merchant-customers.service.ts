import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerSegmentDto,
  CustomerExportDto,
  CustomerListQuery,
  CustomerScopeQuery,
  CustomerSegment,
  CustomSegmentDto,
  SEGMENTS,
  MerchantCustomerDto,
  MerchantCustomerListDto,
  MerchantCustomerDetailDto,
  SegmentPreviewDto,
  SegmentPreviewResultDto,
  UpdateCustomerSegmentDto,
} from './customer.dto';
import { checkRules, rulesSql, SEGMENT_SQL, type SegmentRule } from './segments';

type CustomerRow = {
  id: string;
  name: string | null;
  segment: CustomerSegment;
  custom_segment_id: string | null;
  custom_segment_name: string | null;
  custom_manual: boolean | null;
  balance: number | null;
  first_visit: Date | null;
  last_visit: Date | null;
  joined: Date;
  visits: bigint;
  visits90: bigint;
  spend: Prisma.Decimal;
  redemptions: bigint;
  as_of: string;
};
type ContactRow = CustomerRow & { email: string | null; phone: string | null };

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  match: 'all' | 'any';
  rules: SegmentRule[];
  sort_order: number;
};

type Tx = Prisma.TransactionClient | PrismaService;

/** Rows an export returns at most (a merchant's whole customer list fits easily). */
const EXPORT_LIMIT = 20000;

const money = (n: Prisma.Decimal | string | null) =>
  new Prisma.Decimal(n ?? 0).toFixed(2);
const mapCustomer = (r: CustomerRow): MerchantCustomerDto => ({
  id: r.id,
  reference: r.id.slice(0, 8).toUpperCase(),
  name: r.name,
  segment: r.segment,
  customSegment: r.custom_segment_id
    ? { id: r.custom_segment_id, name: r.custom_segment_name!, manual: !!r.custom_manual }
    : null,
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
const mapSegment = (s: SegmentRow, count: number): CustomSegmentDto => ({
  id: s.id,
  name: s.name,
  description: s.description,
  match: s.match,
  rules: s.rules,
  sortOrder: s.sort_order,
  count,
});
const repeatable = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

@Injectable()
export class MerchantCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private branch(ctx: StaffContext, requested?: string) {
    // merchant-wide accounts (admin, viewer) choose; branch roles are held to theirs
    return ctx.branchId ?? requested;
  }

  private segments(tx: Tx, vendorId: string) {
    return tx.$queryRaw<SegmentRow[]>`
      SELECT id, name, description, match, rules, sort_order FROM customer_segments
      WHERE vendor_id = ${vendorId}::uuid AND status = 'active'
      ORDER BY sort_order, created_at, id`;
  }

  /** One shared classification for counts, filtering, profiles and exports. All intervals use Cairo days.
   * Built-in segment: exactly one per card (see segments.ts). Custom segment: at most one, a
   * hand-added one first, then the first segment (list order) whose rules match and that the
   * customer wasn't removed from by hand. Branch scope includes only cards with events there,
   * and never exposes other-branch totals; rules are checked against the same scoped numbers.
   * Contact details are only selected for exports (email + phone) and profiles (phone).
   */
  private roster(
    vendorId: string,
    segments: SegmentRow[],
    opts: { branchId?: string; cardId?: string; contact?: boolean } = {},
  ) {
    const { branchId, cardId, contact } = opts;
    const manualFirst = segments.map((s) => Prisma.sql`WHEN ${s.id}::uuid = ANY(inc) THEN ${s.id}::uuid`);
    const byRules = segments.map(
      (s) => Prisma.sql`WHEN NOT ${s.id}::uuid = ANY(exc) AND ${rulesSql(s.match, s.rules)} THEN ${s.id}::uuid`,
    );
    const custom = segments.length
      ? Prisma.sql`CASE ${Prisma.join([...manualFirst, ...byRules], ' ')} END`
      : Prisma.sql`NULL::uuid`;
    return Prisma.sql`
      WITH clock AS (SELECT (now() AT TIME ZONE 'Africa/Cairo')::date AS today),
      activity AS (
        SELECT e.card_id, min(e.created_at) FILTER (WHERE e.type = 'earn') AS first_visit,
          max(e.created_at) FILTER (WHERE e.type = 'earn') AS last_visit,
          count(*) FILTER (WHERE e.type = 'earn') AS visits,
          count(*) FILTER (WHERE e.type = 'earn' AND e.created_at >=
            ((clock.today - 29)::timestamp AT TIME ZONE 'Africa/Cairo')) AS visits30,
          count(*) FILTER (WHERE e.type = 'earn' AND e.created_at >=
            ((clock.today - 89)::timestamp AT TIME ZONE 'Africa/Cairo')) AS visits90,
          coalesce(sum(e.purchase_amount) FILTER (WHERE e.type = 'earn'), 0) AS spend,
          count(*) FILTER (WHERE e.type = 'redeem') AS redemptions
        FROM point_events e CROSS JOIN clock
        WHERE e.vendor_id = ${vendorId}::uuid AND e.created_at <= now()
          ${branchId ? Prisma.sql`AND e.branch_id = ${branchId}::uuid` : Prisma.empty}
          ${cardId ? Prisma.sql`AND e.card_id = ${cardId}::uuid` : Prisma.empty}
        GROUP BY e.card_id
      ), base AS (
        SELECT c.id, u.name, ${branchId ? Prisma.sql`NULL::integer` : Prisma.sql`c.balance`} AS balance,
          ${contact ? Prisma.sql`u.email, u.phone,` : Prisma.empty}
          a.first_visit, a.last_visit, least(c.created_at, a.first_visit) AS joined,
          coalesce(a.visits, 0) AS visits, coalesce(a.visits30, 0) AS visits30,
          coalesce(a.visits90, 0) AS visits90, coalesce(a.spend, 0) AS spend,
          coalesce(a.redemptions, 0) AS redemptions, to_char(clock.today, 'YYYY-MM-DD') AS as_of,
          clock.today - (a.last_visit AT TIME ZONE 'Africa/Cairo')::date AS days_since_visit,
          clock.today - (least(c.created_at, a.first_visit) AT TIME ZONE 'Africa/Cairo')::date AS joined_days
        FROM cards c JOIN users u ON u.id = c.user_id CROSS JOIN clock
        LEFT JOIN activity a ON a.card_id = c.id
        WHERE c.vendor_id = ${vendorId}::uuid
          ${branchId ? Prisma.sql`AND a.card_id IS NOT NULL` : Prisma.empty}
          ${cardId ? Prisma.sql`AND c.id = ${cardId}::uuid` : Prisma.empty}
      ), classified AS (
        SELECT base.*, ${SEGMENT_SQL} AS segment FROM base
      ), manual AS (
        SELECT card_id,
          coalesce(array_agg(segment_id) FILTER (WHERE included), '{}') AS inc,
          coalesce(array_agg(segment_id) FILTER (WHERE NOT included), '{}') AS exc
        FROM customer_segment_members WHERE vendor_id = ${vendorId}::uuid
          ${cardId ? Prisma.sql`AND card_id = ${cardId}::uuid` : Prisma.empty}
        GROUP BY card_id
      ), assigned AS (
        SELECT classified.*, coalesce(m.inc, '{}') AS inc, coalesce(m.exc, '{}') AS exc FROM classified
        LEFT JOIN manual m ON m.card_id = classified.id
      ), roster AS (
        SELECT x.*, x.custom_segment_id = ANY(x.inc) AS custom_manual, s.name AS custom_segment_name
        FROM (SELECT assigned.*, ${custom} AS custom_segment_id FROM assigned) x
        LEFT JOIN customer_segments s ON s.id = x.custom_segment_id
      )`;
  }

  private filters(q: CustomerListQuery) {
    const search = q.search?.trim().replace(/^#/, '') ?? '';
    // strpos makes %, _ and quotes literal; no email/phone lookup or wildcard search.
    return Prisma.sql`WHERE true
      ${
        search
          ? Prisma.sql`AND (strpos(lower(coalesce(name, '')), lower(${search})) > 0 OR
        strpos(upper(left(id::text, 8)), upper(${search})) > 0)`
          : Prisma.empty
      }
      ${q.segment ? Prisma.sql`AND segment = ${q.segment}` : Prisma.empty}
      ${q.customSegment ? Prisma.sql`AND custom_segment_id = ${q.customSegment}::uuid` : Prisma.empty}`;
  }

  private order(q: CustomerListQuery) {
    return {
      recent: Prisma.sql`last_visit DESC NULLS LAST, id`,
      spend: Prisma.sql`spend DESC, id`,
      visits: Prisma.sql`visits DESC, id`,
      name: Prisma.sql`lower(name) ASC NULLS LAST, id`,
    }[q.sort ?? 'recent'];
  }

  async list(
    ctx: StaffContext,
    q: CustomerListQuery,
  ): Promise<MerchantCustomerListDto> {
    const branchId = this.branch(ctx, q.branchId);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const where = this.filters(q);
    return this.prisma.$transaction(async (tx) => {
      const segments = await this.segments(tx, ctx.vendorId);
      const roster = this.roster(ctx.vendorId, segments, { branchId });
      const rows = await tx.$queryRaw<
        CustomerRow[]
      >`${roster} SELECT * FROM roster ${where}
        ORDER BY ${this.order(q)} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      const [total] = await tx.$queryRaw<
        { n: bigint }[]
      >`${roster} SELECT count(*) AS n FROM roster ${where}`;
      const counts = await tx.$queryRaw<
        { segment: CustomerSegment; custom: string | null; n: bigint }[]
      >`${roster} SELECT segment, custom_segment_id AS custom, count(*) AS n FROM roster
        GROUP BY segment, custom_segment_id`;
      const [clock] = await tx.$queryRaw<
        { day: string }[]
      >`SELECT to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS day`;
      const sum = (pick: (c: (typeof counts)[number]) => boolean) =>
        counts.filter(pick).reduce((n, c) => n + Number(c.n), 0);
      return {
        items: rows.map(mapCustomer),
        total: Number(total.n),
        page,
        pageSize,
        customersTotal: sum(() => true),
        segments: SEGMENTS.map((key) => ({ key, count: sum((c) => c.segment === key) })),
        customSegments: segments.map((s) => mapSegment(s, sum((c) => c.custom === s.id))),
        asOf: clock.day,
      };
    }, repeatable);
  }

  async detail(
    ctx: StaffContext,
    cardId: string,
    q: CustomerScopeQuery,
  ): Promise<MerchantCustomerDetailDto> {
    const branchId = this.branch(ctx, q.branchId);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    return this.prisma.$transaction(async (tx) => {
      const segments = await this.segments(tx, ctx.vendorId);
      const [row] = await tx.$queryRaw<
        ContactRow[]
      >`${this.roster(ctx.vendorId, segments, { branchId, cardId, contact: true })} SELECT * FROM roster`;
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
        customer: { ...mapCustomer(row), phone: row.phone },
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
    }, repeatable);
  }

  /** Every customer matching the list filters, with email and phone (merchant admins only). */
  async export(ctx: StaffContext, q: CustomerListQuery): Promise<CustomerExportDto> {
    return this.prisma.$transaction(async (tx) => {
      const segments = await this.segments(tx, ctx.vendorId);
      const rows = await tx.$queryRaw<ContactRow[]>`
        ${this.roster(ctx.vendorId, segments, { branchId: q.branchId, contact: true })}
        SELECT * FROM roster ${this.filters(q)} ORDER BY ${this.order(q)} LIMIT ${EXPORT_LIMIT + 1}`;
      const [clock] = await tx.$queryRaw<
        { day: string }[]
      >`SELECT to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS day`;
      return {
        items: rows.slice(0, EXPORT_LIMIT).map((r) => ({
          ...mapCustomer(r),
          email: r.email,
          phone: r.phone,
          joinedAt: r.joined.toISOString(),
        })),
        truncated: rows.length > EXPORT_LIMIT,
        asOf: clock.day,
      };
    }, repeatable);
  }

  // ── Custom segments (changing: vendor_admin) ───────────────────────

  private async segmentOr404(tx: Tx, ctx: StaffContext, id: string) {
    const [s] = await tx.$queryRaw<SegmentRow[]>`
      SELECT id, name, description, match, rules, sort_order FROM customer_segments
      WHERE id = ${id}::uuid AND vendor_id = ${ctx.vendorId}::uuid AND status = 'active'`;
    if (!s) throw new NotFoundException({ code: 'segment_not_found' });
    return s;
  }

  private async withCount(ctx: StaffContext, id: string): Promise<CustomSegmentDto> {
    const list = await this.list(ctx, { pageSize: 1 });
    const s = list.customSegments.find((x) => x.id === id);
    if (!s) throw new NotFoundException({ code: 'segment_not_found' });
    return s;
  }

  /** 409 segment_name_taken on the active-name unique index. */
  private nameTaken(e: unknown): never {
    const meta = e instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(e.meta ?? {}) : '';
    if (`${String(e)} ${meta}`.includes('customer_segments_name_uq'))
      throw new ConflictException({ code: 'segment_name_taken' });
    throw e;
  }

  async createSegment(ctx: StaffContext, dto: CreateCustomerSegmentDto): Promise<CustomSegmentDto> {
    const rules = checkRules(dto.rules ?? []);
    let id: string;
    try {
      [{ id }] = await this.prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO customer_segments (vendor_id, name, description, match, rules, sort_order, created_by_staff_id)
        VALUES (${ctx.vendorId}::uuid, ${dto.name}, ${dto.description ?? null}, ${dto.match ?? 'all'},
          ${JSON.stringify(rules)}::jsonb,
          (SELECT coalesce(max(sort_order) + 1, 0) FROM customer_segments WHERE vendor_id = ${ctx.vendorId}::uuid),
          ${ctx.staffId}::uuid)
        RETURNING id`;
    } catch (e) {
      this.nameTaken(e);
    }
    return this.withCount(ctx, id);
  }

  async updateSegment(ctx: StaffContext, id: string, dto: UpdateCustomerSegmentDto): Promise<CustomSegmentDto> {
    const s = await this.segmentOr404(this.prisma, ctx, id);
    const rules = dto.rules ? checkRules(dto.rules) : s.rules;
    try {
      await this.prisma.$executeRaw`
        UPDATE customer_segments SET
          name = ${dto.name ?? s.name},
          description = ${dto.description === undefined ? s.description : dto.description},
          match = ${dto.match ?? s.match},
          rules = ${JSON.stringify(rules)}::jsonb,
          sort_order = ${dto.sortOrder ?? s.sort_order}
        WHERE id = ${id}::uuid AND vendor_id = ${ctx.vendorId}::uuid`;
    } catch (e) {
      this.nameTaken(e);
    }
    return this.withCount(ctx, id);
  }

  /** Archived, not deleted (its customers simply fall back to no custom segment). */
  async archiveSegment(ctx: StaffContext, id: string): Promise<void> {
    await this.segmentOr404(this.prisma, ctx, id);
    await this.prisma.$executeRaw`
      UPDATE customer_segments SET status = 'archived'
      WHERE id = ${id}::uuid AND vendor_id = ${ctx.vendorId}::uuid`;
  }

  /** How many customers the rules match now (the "N customers" line while building a segment). */
  async previewSegment(ctx: StaffContext, dto: SegmentPreviewDto): Promise<SegmentPreviewResultDto> {
    const rules = checkRules(dto.rules);
    const branchId = this.branch(ctx, dto.branchId);
    const [r] = await this.prisma.$queryRaw<{ n: bigint; total: bigint }[]>`
      ${this.roster(ctx.vendorId, [], { branchId })}
      SELECT count(*) FILTER (WHERE ${rulesSql(dto.match ?? 'all', rules)}) AS n, count(*) AS total FROM roster`;
    return { count: Number(r.n), customersTotal: Number(r.total) };
  }

  /**
   * Adds a customer to a segment by hand. A customer has one custom segment, so this also
   * drops their other hand-made additions; a "removed by hand" mark on this segment is lifted.
   */
  async addMember(ctx: StaffContext, segmentId: string, cardId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.segmentOr404(tx, ctx, segmentId);
      const card = await tx.cards.findFirst({ where: { id: cardId, vendor_id: ctx.vendorId }, select: { id: true } });
      if (!card) throw new NotFoundException({ code: 'customer_not_found' });
      await tx.$executeRaw`
        DELETE FROM customer_segment_members
        WHERE vendor_id = ${ctx.vendorId}::uuid AND card_id = ${cardId}::uuid AND included AND segment_id <> ${segmentId}::uuid`;
      await tx.$executeRaw`
        INSERT INTO customer_segment_members (segment_id, card_id, vendor_id, included, set_by_staff_id)
        VALUES (${segmentId}::uuid, ${cardId}::uuid, ${ctx.vendorId}::uuid, true, ${ctx.staffId}::uuid)
        ON CONFLICT (segment_id, card_id) DO UPDATE SET included = true, set_by_staff_id = EXCLUDED.set_by_staff_id`;
    });
  }

  /** Takes a customer out of a segment by hand: stays out even if the rules match. */
  async removeMember(ctx: StaffContext, segmentId: string, cardId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.segmentOr404(tx, ctx, segmentId);
      const card = await tx.cards.findFirst({ where: { id: cardId, vendor_id: ctx.vendorId }, select: { id: true } });
      if (!card) throw new NotFoundException({ code: 'customer_not_found' });
      await tx.$executeRaw`
        INSERT INTO customer_segment_members (segment_id, card_id, vendor_id, included, set_by_staff_id)
        VALUES (${segmentId}::uuid, ${cardId}::uuid, ${ctx.vendorId}::uuid, false, ${ctx.staffId}::uuid)
        ON CONFLICT (segment_id, card_id) DO UPDATE SET included = false, set_by_staff_id = EXCLUDED.set_by_staff_id`;
    });
  }
}
