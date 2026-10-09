import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { fromMinor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminMeResponseDto,
  AdminUserDetailDto,
  AdminUserListDto,
  AdminUserListItemDto,
  ListUsersQueryDto,
  OverviewResponseDto,
} from './dto/admin.dto';

/** Days, "today" and "the last N days" are counted in Cairo time. */
const TZ = 'Africa/Cairo';

const userListInclude = {
  cards: { select: { balance: true, last_activity_at: true } },
} satisfies Prisma.usersInclude;
type UserWithCards = Prisma.usersGetPayload<{ include: typeof userListInclude }>;

/** The platform admin's view of the whole system: overview numbers and customers. */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async me(adminId: string): Promise<AdminMeResponseDto> {
    const a = await this.prisma.platform_admins.findUniqueOrThrow({ where: { id: adminId } });
    return { id: a.id, name: a.name, email: a.email };
  }

  async overview(): Promise<OverviewResponseDto> {
    const [counts] = await this.prisma.$queryRaw<
      {
        vendors_active: bigint;
        vendors_suspended: bigint;
        branches_open: bigint;
        customers: bigint;
        customers_blocked: bigint;
        customers_new7d: bigint;
        cards: bigint;
        points_earned: bigint | null;
        points_redeemed: bigint | null;
        points_outstanding: bigint | null;
        collects_today: bigint;
      }[]
    >`
      SELECT
        (SELECT count(*) FROM vendors WHERE status = 'active')                         AS vendors_active,
        (SELECT count(*) FROM vendors WHERE status = 'suspended')                      AS vendors_suspended,
        (SELECT count(*) FROM branches WHERE status = 'active')                        AS branches_open,
        (SELECT count(*) FROM users)                                                   AS customers,
        (SELECT count(*) FROM users WHERE status = 'blocked')                          AS customers_blocked,
        (SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days')     AS customers_new7d,
        (SELECT count(*) FROM cards)                                                   AS cards,
        (SELECT sum(delta) FROM point_events WHERE type = 'earn')                      AS points_earned,
        (SELECT -sum(delta) FROM point_events WHERE type = 'redeem')                   AS points_redeemed,
        (SELECT sum(balance) FROM cards)                                               AS points_outstanding,
        (SELECT count(*) FROM point_events
          WHERE type = 'earn'
            AND (created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date) AS collects_today`;

    const days = await this.prisma.$queryRaw<
      { day: string; points: bigint | null; collects: bigint; new_customers: bigint }[]
    >`
      WITH d AS (
        SELECT generate_series((now() AT TIME ZONE ${TZ})::date - 13, (now() AT TIME ZONE ${TZ})::date, interval '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             (SELECT sum(delta) FROM point_events e
               WHERE e.type = 'earn' AND (e.created_at AT TIME ZONE ${TZ})::date = d.day) AS points,
             (SELECT count(*) FROM point_events e
               WHERE e.type = 'earn' AND (e.created_at AT TIME ZONE ${TZ})::date = d.day) AS collects,
             (SELECT count(*) FROM users u WHERE (u.created_at AT TIME ZONE ${TZ})::date = d.day) AS new_customers
      FROM d ORDER BY d.day`;

    const top = await this.prisma.$queryRaw<
      { id: string; name: string; logo_url: string | null; points: bigint; collects: bigint }[]
    >`
      SELECT v.id, v.name, v.logo_url, sum(e.delta) AS points, count(*) AS collects
      FROM point_events e JOIN vendors v ON v.id = e.vendor_id
      WHERE e.type = 'earn' AND e.created_at >= now() - interval '30 days'
      GROUP BY v.id, v.name, v.logo_url
      ORDER BY points DESC
      LIMIT 5`;

    const n = (v: bigint | null) => Number(v ?? 0);
    return {
      vendorsActive: n(counts.vendors_active),
      vendorsSuspended: n(counts.vendors_suspended),
      branchesOpen: n(counts.branches_open),
      customers: n(counts.customers),
      customersBlocked: n(counts.customers_blocked),
      customersNew7d: n(counts.customers_new7d),
      cards: n(counts.cards),
      pointsEarned: n(counts.points_earned),
      pointsRedeemed: n(counts.points_redeemed),
      pointsOutstanding: n(counts.points_outstanding),
      collectsToday: n(counts.collects_today),
      days: days.map((d) => ({
        date: d.day,
        pointsEarned: n(d.points),
        collects: n(d.collects),
        newCustomers: n(d.new_customers),
      })),
      topVendors: top.map((v) => ({
        id: v.id,
        name: v.name,
        logoUrl: v.logo_url,
        pointsEarned: n(v.points),
        collects: n(v.collects),
      })),
    };
  }

  /** Customers, newest first, searchable by name / email / phone, 20 per page. */
  async listUsers(query: ListUsersQueryDto): Promise<AdminUserListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const term = query.search?.trim();
    const where: Prisma.usersWhereInput = {
      status: query.status,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        include: userListInclude,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: users.map((u) => listItem(u)), total, page, pageSize };
  }

  async getUser(id: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.users.findUnique({ where: { id }, include: userListInclude });
    if (!user) throw new NotFoundException({ code: 'user_not_found' });

    const [cards, events] = await Promise.all([
      this.prisma.cards.findMany({
        where: { user_id: id },
        include: { vendors: { select: { name: true, logo_url: true } } },
        orderBy: { last_activity_at: 'desc' },
      }),
      this.prisma.point_events.findMany({
        where: { cards: { user_id: id } },
        include: {
          vendors: { select: { name: true } },
          branches: { select: { name: true } },
          rewards: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
    ]);

    return {
      ...listItem(user),
      gender: user.gender,
      birthDate: user.birth_date?.toISOString().slice(0, 10) ?? null,
      cards: cards.map((c) => ({
        id: c.id,
        vendorId: c.vendor_id,
        vendorName: c.vendors.name,
        vendorLogoUrl: c.vendors.logo_url,
        balance: c.balance,
        lifetimePoints: c.lifetime_points,
        lastActivityAt: c.last_activity_at.toISOString(),
      })),
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        delta: e.delta,
        vendorName: e.vendors.name,
        branchName: e.branches?.name ?? null,
        purchaseAmount: e.purchase_amount === null ? null : fromMinor(toMinor(e.purchase_amount)),
        rewardName: e.rewards?.name ?? null,
        reason: e.reason,
        createdAt: e.created_at.toISOString(),
      })),
    };
  }

  /** Block (the customer can no longer use the app or collect) or unblock. */
  async setUserStatus(id: string, status: 'active' | 'blocked'): Promise<AdminUserDetailDto> {
    const found = await this.prisma.users.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'user_not_found' });
    await this.prisma.users.update({ where: { id }, data: { status } });
    return this.getUser(id);
  }
}

function listItem(u: UserWithCards): AdminUserListItemDto {
  const last = u.cards.reduce<Date | null>(
    (max, c) => (max === null || c.last_activity_at > max ? c.last_activity_at : max),
    null,
  );
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    avatarUrl: u.avatar_url,
    cardsCount: u.cards.length,
    pointsBalance: u.cards.reduce((sum, c) => sum + c.balance, 0),
    lastActivityAt: last?.toISOString() ?? null,
    createdAt: u.created_at.toISOString(),
  };
}
