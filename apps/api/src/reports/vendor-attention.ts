import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { Prisma } from '../generated/prisma/client.js';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { activePause, readWeek } from '../branches/hours';
import { PrismaService } from '../prisma/prisma.service';
import { activeSoldOut } from '../rewards/reward-sold-outs.service';

const TZ = 'Africa/Cairo';

/** Unusual activity (the fraud-flag rules, checked live; they only point, never block). */
const COLLECTS_PER_CARD_PER_DAY = 3; // more than this from one card in a day
const STAFF_SPIKE = 3; // today's collects > 3× the staff member's usual day…
const STAFF_SPIKE_MIN = 10; // …and at least this many
const LARGE_BILL = 5; // a bill > 5× the branch's 30-day average…
const LARGE_BILL_MIN_HISTORY = 20; // …once the branch has this many bills to compare with

type Tone = 'critical' | 'warning' | 'info';

class AttentionActionDto {
  @ApiProperty({ example: 'Set the points rule' }) label: string;
  @ApiProperty({ example: '/rule', description: 'Dashboard path' }) to: string;
}

class AttentionItemDto {
  @ApiProperty({
    example: 'no_active_rule',
    description: 'Stable key (what + which object)',
  })
  key: string;
  @ApiProperty({
    enum: ['now', 'setup'],
    description: 'now = operations today; setup = profile still incomplete',
  })
  group: 'now' | 'setup';
  @ApiProperty({ enum: ['critical', 'warning', 'info'] }) tone: Tone;
  @ApiProperty() title: string;
  @ApiProperty({ type: String, nullable: true }) detail: string | null;
  @ApiProperty({ type: AttentionActionDto }) action: AttentionActionDto;
}

export class VendorAttentionDto {
  @ApiProperty({ type: [AttentionItemDto], description: 'Most urgent first' })
  items: AttentionItemDto[];
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });

/**
 * "What needs me now" for the dashboard home: things stopping customers today, unusual
 * activity in the ledger, and setup still missing. A branch manager gets their branch's items;
 * vendor-wide setup (rule, profile, rewards, staff) is for the vendor admin, who can fix it.
 */
@Injectable()
export class VendorAttentionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: StaffContext): Promise<VendorAttentionDto> {
    const v = ctx.vendorId;
    const admin = ctx.role === 'vendor_admin';
    const branchWhere = {
      vendor_id: v,
      status: 'active' as const,
      ...(admin ? {} : { id: ctx.branchId! }),
    };

    const [vendor, rule, rewards, branches, staffCount, soldOut] =
      await Promise.all([
        this.prisma.vendors.findUniqueOrThrow({
          where: { id: v },
          select: { logo_url: true, banner_url: true },
        }),
        this.prisma.point_rules.findFirst({
          where: { vendor_id: v, is_active: true },
          select: { id: true },
        }),
        this.prisma.rewards.findMany({
          where: { vendor_id: v, status: 'active' },
          select: { image_url: true, name_ar: true },
        }),
        this.prisma.branches.findMany({
          where: branchWhere,
          orderBy: { name: 'asc' },
        }),
        this.prisma.staff_users.count({
          where: {
            vendor_id: v,
            status: 'active',
            role: { not: 'vendor_admin' },
          },
        }),
        this.prisma.reward_sold_outs.findMany({
          where: { vendor_id: v, branches: branchWhere, ...activeSoldOut() },
          select: { branch_id: true, branches: { select: { name: true } } },
        }),
      ]);
    const items: AttentionItemDto[] = [];
    const add = (i: AttentionItemDto) => items.push(i);

    // ── Now: customers are affected today ─────────────────────────────
    if (!rule) {
      add({
        key: 'no_active_rule',
        group: 'now',
        tone: 'critical',
        title: 'Customers can’t earn points',
        detail:
          'There is no active points rule, so staff can’t give points at any branch.',
        action: admin
          ? { label: 'Set the points rule', to: '/rule' }
          : { label: 'See the points rule', to: '/rule' },
      });
    }
    if (!rewards.length) {
      add({
        key: 'no_active_rewards',
        group: 'now',
        tone: 'critical',
        title: 'No rewards to redeem',
        detail: 'Customers collect points but have nothing to spend them on.',
        action: {
          label: admin ? 'Add a reward' : 'See rewards',
          to: '/rewards',
        },
      });
    }
    for (const b of branches) {
      const until = activePause(b.paused_until);
      if (until) {
        add({
          key: `branch_paused:${b.id}`,
          group: 'now',
          tone: 'warning',
          title: `${b.name} is temporarily closed`,
          detail: `Customers see it as closed until ${clock(until)}.`,
          action: { label: 'Open again', to: '/branches' },
        });
      }
    }
    const soldOutByBranch = new Map<string, { name: string; n: number }>();
    for (const s of soldOut) {
      const cur = soldOutByBranch.get(s.branch_id) ?? {
        name: s.branches.name,
        n: 0,
      };
      soldOutByBranch.set(s.branch_id, { ...cur, n: cur.n + 1 });
    }
    for (const [id, s] of soldOutByBranch) {
      add({
        key: `sold_out:${id}`,
        group: 'now',
        tone: 'info',
        title: `${plural(s.n, 'reward')} sold out at ${s.name}`,
        detail: 'Staff there can’t give them until they’re back on sale.',
        action: { label: 'Check availability', to: '/rewards' },
      });
    }
    items.push(...(await this.unusual(ctx)));

    // ── Setup: still missing (the person who can fix it) ──────────────
    const noPhoto = rewards.filter((r) => !r.image_url).length;
    const noArabic = rewards.filter((r) => !r.name_ar).length;
    if (admin && noPhoto) {
      add({
        key: 'rewards_no_photo',
        group: 'setup',
        tone: 'info',
        title: `${plural(noPhoto, 'reward')} without a photo`,
        detail: 'Rewards with a photo get noticed more in the app.',
        action: { label: 'Add photos', to: '/rewards' },
      });
    }
    if (admin && noArabic) {
      add({
        key: 'rewards_no_arabic',
        group: 'setup',
        tone: 'info',
        title: `${plural(noArabic, 'reward')} without an Arabic name`,
        detail:
          'Customers using the app in Arabic see the English name instead.',
        action: { label: 'Add Arabic names', to: '/rewards' },
      });
    }
    const noHours = branches.filter((b) => !readWeek(b.weekly_hours)?.length);
    const noMap = branches.filter((b) => b.lat === null || b.lng === null);
    if (admin && noHours.length) {
      add({
        key: 'branches_no_hours',
        group: 'setup',
        tone: 'info',
        title:
          noHours.length === 1
            ? `${noHours[0].name} has no opening hours`
            : `${noHours.length} branches have no opening hours`,
        detail: 'Customers can’t tell when to come by.',
        action: { label: 'Set hours', to: '/branches' },
      });
    }
    if (admin && noMap.length) {
      add({
        key: 'branches_no_location',
        group: 'setup',
        tone: 'info',
        title:
          noMap.length === 1
            ? `${noMap[0].name} isn’t on the map`
            : `${noMap.length} branches aren’t on the map`,
        detail:
          'Without a map pin, customers get no directions and the branch isn’t in “Near you”.',
        action: { label: 'Pick on the map', to: '/branches' },
      });
    }
    if (admin && (!vendor.logo_url || !vendor.banner_url)) {
      const missing = [
        !vendor.logo_url && 'logo',
        !vendor.banner_url && 'banner',
      ]
        .filter(Boolean)
        .join(' and ');
      add({
        key: 'profile_branding',
        group: 'setup',
        tone: 'info',
        title: `Your shop has no ${missing}`,
        detail: 'They make your shop page and cards in the app look like you.',
        action: { label: 'Open shop profile', to: '/profile' },
      });
    }
    if (admin && staffCount === 0) {
      add({
        key: 'no_staff',
        group: 'setup',
        tone: 'info',
        title: 'No staff invited yet',
        detail:
          'Cashiers need their own sign-in for the staff app to scan customers.',
        action: { label: 'Invite staff', to: '/staff' },
      });
    }

    const rank: Record<Tone, number> = { critical: 0, warning: 1, info: 2 };
    items.sort(
      (a, b) =>
        (a.group === b.group ? 0 : a.group === 'now' ? -1 : 1) ||
        rank[a.tone] - rank[b.tone],
    );
    return { items };
  }

  /** Today (Cairo) compared with the last 30 days; branch managers: their branch only. */
  private async unusual(ctx: StaffContext): Promise<AttentionItemDto[]> {
    const v = ctx.vendorId;
    const branch =
      ctx.role === 'vendor_admin'
        ? Prisma.empty
        : Prisma.sql`AND e.branch_id = ${ctx.branchId}::uuid`;
    const today = Prisma.sql`(e.created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date`;
    const before = Prisma.sql`e.created_at >= now() - interval '30 days' AND NOT ${today}`;

    const [cards, staff, bills] = await Promise.all([
      this.prisma.$queryRaw<{ card_id: string; n: bigint }[]>`
        SELECT e.card_id, count(*) AS n FROM point_events e
        WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' AND ${today} ${branch}
        GROUP BY e.card_id HAVING count(*) > ${COLLECTS_PER_CARD_PER_DAY}
        ORDER BY n DESC LIMIT 5`,
      this.prisma.$queryRaw<
        { id: string; name: string; today: bigint; usual: number }[]
      >`
        SELECT s.id, s.name,
               count(*) FILTER (WHERE ${today}) AS today,
               (count(*) FILTER (WHERE ${before}))::float / 30 AS usual
        FROM point_events e JOIN staff_users s ON s.id = e.staff_id
        WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' AND e.created_at >= now() - interval '31 days' ${branch}
        GROUP BY s.id, s.name
        HAVING count(*) FILTER (WHERE ${today}) >= ${STAFF_SPIKE_MIN}
           AND count(*) FILTER (WHERE ${before}) >= ${STAFF_SPIKE_MIN} -- a new cashier's first busy day isn't unusual
           AND count(*) FILTER (WHERE ${today}) > ${STAFF_SPIKE} * (count(*) FILTER (WHERE ${before}))::float / 30
        ORDER BY today DESC LIMIT 5`,
      this.prisma.$queryRaw<
        { id: string; amount: string; branch: string; avg: string }[]
      >`
        WITH usual AS (
          SELECT e.branch_id, avg(e.purchase_amount) AS avg, count(*) AS n FROM point_events e
          WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' AND ${before} ${branch}
          GROUP BY e.branch_id
        )
        SELECT e.id, e.purchase_amount::text AS amount, b.name AS branch, round(u.avg)::text AS avg
        FROM point_events e JOIN usual u ON u.branch_id = e.branch_id JOIN branches b ON b.id = e.branch_id
        WHERE e.vendor_id = ${v}::uuid AND e.type = 'earn' AND ${today} ${branch}
          AND u.n >= ${LARGE_BILL_MIN_HISTORY} AND e.purchase_amount > ${LARGE_BILL} * u.avg
        ORDER BY e.purchase_amount DESC LIMIT 5`,
    ]);

    const currency = (
      await this.prisma.vendors.findUniqueOrThrow({
        where: { id: v },
        select: { currency: true },
      })
    ).currency;
    const money = (s: string) =>
      `${Number(s).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
    return [
      ...staff.map((s) => ({
        key: `staff_spike:${s.id}`,
        group: 'now' as const,
        tone: 'warning' as const,
        title: `${s.name} gave points ${Number(s.today)} times today`,
        detail: `Usually about ${Math.max(1, Math.round(s.usual))} a day. Worth a look in Activity.`,
        action: { label: 'Review activity', to: '/activity' },
      })),
      ...cards.map((c) => ({
        key: `card_spike:${c.card_id}`,
        group: 'now' as const,
        tone: 'warning' as const,
        title: `Card #${c.card_id.slice(0, 6).toUpperCase()} collected ${Number(c.n)} times today`,
        detail: 'More than 3 collects in a day from one customer is unusual.',
        action: { label: 'Review activity', to: '/activity' },
      })),
      ...bills.map((b) => ({
        key: `large_bill:${b.id}`,
        group: 'now' as const,
        tone: 'warning' as const,
        title: `A ${money(b.amount)} bill at ${b.branch}`,
        detail: `Bills there are usually about ${money(b.avg)}. Check it was typed right.`,
        action: { label: 'Review activity', to: '/activity' },
      })),
    ];
  }
}

@VendorApi('vendor: attention')
@Controller('vendor/attention')
export class VendorAttentionController {
  constructor(private readonly attention: VendorAttentionService) {}

  /** Dashboard home: what needs the signed-in manager or admin now, most urgent first. */
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: VendorAttentionDto })
  list(@CurrentStaff() ctx: StaffContext): Promise<VendorAttentionDto> {
    return this.attention.list(ctx);
  }
}
