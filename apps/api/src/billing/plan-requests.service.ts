import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { type BillingCycle, type Plan } from '../plans/plans';
import { BillingService } from './billing.service';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * The dvote team's side of plan change requests (admin Plan requests page). Approve after taking the
 * money: an upgrade starts at once (a monthly ↔ annual part waits for renewal); a downgrade or cycle
 * switch is scheduled for the end of the paid period, with the branches and rewards the merchant
 * chose to keep. A request whose shop changed plan since it was sent is refused (409 request_outdated).
 */
@Injectable()
export class PlanRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async list(status: RequestStatus | 'all', page: number, pageSize: number) {
    const where = status === 'all' ? {} : { status };
    const [rows, total, pending] = await Promise.all([
      this.prisma.plan_requests.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.plan_requests.count({ where }),
      this.prisma.plan_requests.count({ where: { status: 'pending' } }),
    ]);
    const vendorIds = [...new Set(rows.map((r) => r.vendor_id))];
    const staffIds = [...new Set(rows.map((r) => r.requested_by))];
    const adminIds = [...new Set(rows.map((r) => r.reviewed_by).filter((x): x is string => !!x))];
    const [vendors, staff, admins] = await Promise.all([
      this.prisma.vendors.findMany({
        where: { id: { in: vendorIds } },
        select: { id: true, name: true, slug: true, plan: true, billing_cycle: true, paid_until: true, paid_branches: true, contact_phone: true },
      }),
      this.prisma.staff_users.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, email: true } }),
      this.prisma.platform_admins.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }),
    ]);
    const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
    const V = byId(vendors);
    const S = byId(staff);
    const A = byId(admins);
    return {
      total,
      pending,
      items: rows.map((r) => {
        const v = V.get(r.vendor_id);
        const s = S.get(r.requested_by);
        return {
          ...this.billing.requestDto(r),
          from: { plan: r.from_plan as Plan | null, billingCycle: r.from_cycle as BillingCycle | null, branches: r.from_branches },
          keepBranches: r.keep_branch_ids.length,
          keepRewards: r.keep_reward_ids.length,
          vendor: v
            ? { id: v.id, name: v.name, slug: v.slug, paidUntil: v.paid_until?.toISOString() ?? null, phone: v.contact_phone }
            : { id: r.vendor_id, name: '', slug: '', paidUntil: null, phone: null },
          requestedBy: s ? { name: s.name, email: s.email } : null,
          reviewedBy: r.reviewed_by ? (A.get(r.reviewed_by)?.name ?? null) : null,
        };
      }),
    };
  }

  async approve(id: string, adminId: string, note: string | null, now = new Date()) {
    await this.prisma.$transaction(async (tx) => {
      const r = await this.lockPending(tx, id);
      await tx.$queryRaw`SELECT id FROM vendors WHERE id = ${r.vendor_id}::uuid FOR UPDATE`;
      const v = await tx.vendors.findUniqueOrThrow({
        where: { id: r.vendor_id },
        select: { plan: true, billing_cycle: true, paid_branches: true, plan_status: true, paid_until: true },
      });
      if (v.plan_status !== 'active' || !v.paid_until) {
        throw new ConflictException({ code: 'not_active', message: 'The shop has no paid plan any more.' });
      }
      if (v.plan !== r.from_plan || v.billing_cycle !== r.from_cycle || v.paid_branches !== r.from_branches) {
        throw new ConflictException({ code: 'request_outdated', message: 'The shop’s plan changed since this request. Reject it and ask for a new one.' });
      }
      if (r.kind === 'upgrade') {
        const cycleLater = r.billing_cycle !== v.billing_cycle;
        await tx.vendors.update({
          where: { id: r.vendor_id },
          data: {
            plan: r.plan,
            paid_branches: r.branches,
            next_plan: cycleLater ? r.plan : null,
            next_billing_cycle: cycleLater ? r.billing_cycle : null,
            next_paid_branches: cycleLater ? r.branches : null,
            next_keep: Prisma.DbNull,
          },
        });
      } else {
        await tx.vendors.update({
          where: { id: r.vendor_id },
          data: {
            next_plan: r.plan,
            next_billing_cycle: r.billing_cycle,
            next_paid_branches: r.branches,
            next_keep: { branches: r.keep_branch_ids, rewards: r.keep_reward_ids },
          },
        });
      }
      await tx.plan_requests.update({ where: { id }, data: { status: 'approved', reviewed_by: adminId, reviewed_at: now, review_note: note } });
    });
    return this.one(id);
  }

  async reject(id: string, adminId: string, note: string | null, now = new Date()) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockPending(tx, id);
      await tx.plan_requests.update({ where: { id }, data: { status: 'rejected', reviewed_by: adminId, reviewed_at: now, review_note: note } });
    });
    return this.one(id);
  }

  private async lockPending(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM plan_requests WHERE id = ${id}::uuid FOR UPDATE`;
    if (!rows.length) throw new NotFoundException({ code: 'request_not_found' });
    const r = await tx.plan_requests.findUniqueOrThrow({ where: { id } });
    if (r.status !== 'pending') throw new ConflictException({ code: 'request_not_pending', message: `This request is already ${r.status}.` });
    return r;
  }

  private async one(id: string) {
    return this.billing.requestDto(await this.prisma.plan_requests.findUniqueOrThrow({ where: { id } }));
  }
}
