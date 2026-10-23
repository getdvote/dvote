import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { egyptianMobile } from '../public-join/egyptian-phone';
import { StorageService } from '../storage/storage.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import type { SupabaseClaims } from '../auth/supabase-jwt.verifier';
import { TurnstileService } from './turnstile.service';
import { TRIAL } from './trial-rules';
import { BILLING_CYCLES, PLANS, type BillingCycle, type Plan } from '../plans/plans';
import { PlansService } from '../plans/plans.service';

export { TRIAL } from './trial-rules';
export { PLANS, type Plan };

const DAY = 24 * 60 * 60 * 1000;
const PLAN_SELECT = {
  id: true,
  plan_status: true,
  plan: true,
  billing_cycle: true,
  founding: true,
  trial_ends_at: true,
  delete_at: true,
  status: true,
} as const;

export interface StartSignupInput {
  ownerName: string;
  shopName: string;
  email: string;
  password: string;
  phone: string;
  captchaToken?: string;
  /** The plan picked on dvote.co/pricing (a hint for the dvote team; nothing is charged). */
  plan?: Plan;
  billingCycle?: BillingCycle;
  redirectTo?: string;
}

export interface SignupInput {
  shopName: string;
  ownerName: string;
  phone: string;
}

/**
 * Merchant self sign-up with a free trial, the admin's plan controls, and the background job
 * that locks ended trials (status suspended: public pages, joining and the wallet stop) and
 * deletes unpaid trial shops for good on day 30. The dashboard and scans are blocked at the
 * exact minute by StaffAuthGuard (trial_ended); only `self_signup` shops are ever deleted.
 */
@Injectable()
export class TrialService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(TrialService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly authAdmin: SupabaseAdminService,
    private readonly http: HttpAdapterHost,
    private readonly turnstile: TurnstileService,
    private readonly plans: PlansService,
  ) {}

  onApplicationBootstrap() {
    // not in tests or scripts (they call run() themselves)
    if (process.env.NODE_ENV === 'test' || !this.http?.httpAdapter) return;
    this.timer = setInterval(() => void this.run().catch((e) => this.log.warn(`trial check failed: ${String(e)}`)), TRIAL.checkEveryMs);
    this.timer.unref();
    setTimeout(() => void this.run().catch(() => undefined), 45_000).unref();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /**
   * Step 1 of the merchant sign-up (public, behind the captcha): an unconfirmed account marked
   * as a dvote sign-up, and Supabase's confirmation email. The shop opens in step 2 (signup()).
   */
  async startSignup(input: StartSignupInput, ip?: string): Promise<{ sent: true }> {
    const phone = egyptianMobile(input.phone);
    if (!phone) throw new BadRequestException({ code: 'invalid_phone', message: 'Use an Egyptian mobile number (010, 011, 012 or 015).' });
    await this.turnstile.verify(input.captchaToken, ip);
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.staff_users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) {
      throw new ConflictException({ code: 'email_taken', message: 'This email already has a dvote account. Sign in instead.' });
    }
    const outcome = await this.authAdmin.createSignupAccount(
      email,
      input.password,
      {
        full_name: input.ownerName.trim().replace(/\s+/g, ' '),
        shop_name: input.shopName.trim().replace(/\s+/g, ' '),
        phone,
        ...(input.plan ? { plan: input.plan } : {}),
        ...(input.billingCycle ? { billing_cycle: input.billingCycle } : {}),
      },
      input.redirectTo,
    );
    if (outcome === 'taken') throw new ConflictException({ code: 'email_taken', message: 'This email already has a dvote account. Sign in instead.' });
    return { sent: true };
  }

  /**
   * Step 2: a confirmed Supabase account creates its shop and becomes its merchant admin, on a free
   * trial. One shop per account; never for an existing staff member or platform admin.
   */
  async signup(claims: SupabaseClaims, input: SignupInput) {
    if (await this.prisma.platform_admins.findUnique({ where: { auth_user_id: claims.sub }, select: { id: true } })) {
      throw new ForbiddenException({ code: 'admin_account', message: 'Platform admin accounts cannot open a shop.' });
    }
    // only accounts made by startSignup (behind the captcha) may open a shop
    if (claims.app_metadata?.dvote_signup !== true) {
      throw new ForbiddenException({ code: 'signup_required', message: 'Sign up on the dvote sign-up page first.' });
    }
    const email = claims.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException({ code: 'email_required', message: 'The account has no email.' });
    const phone = egyptianMobile(input.phone);
    if (!phone) throw new BadRequestException({ code: 'invalid_phone', message: 'Use an Egyptian mobile number (010, 011, 012 or 015).' });
    const shopName = input.shopName.trim().replace(/\s+/g, ' ');
    const ownerName = input.ownerName.trim().replace(/\s+/g, ' ');

    const existing = await this.prisma.staff_users.findUnique({
      where: { auth_user_id: claims.sub },
      select: { vendor_id: true, vendors: { select: { self_signup: true, trial_ends_at: true, delete_at: true } } },
    });
    if (existing) {
      // the same account signing up twice (e.g. a retried request): the shop it already made
      if (existing.vendors.self_signup) return this.result(existing.vendor_id, existing.vendors.trial_ends_at, existing.vendors.delete_at);
      throw new ConflictException({ code: 'account_already_staff', message: 'This account already belongs to a shop.' });
    }
    if (await this.prisma.staff_users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) {
      throw new ConflictException({ code: 'email_taken', message: 'This email is already used by a shop team member.' });
    }

    // the plan picked on dvote.co/pricing, kept on the trial shop for the dvote team
    const meta = claims.user_metadata as Record<string, unknown> | undefined;
    const picked = PLANS.find((p) => p === meta?.plan) ?? null;
    const cycle = BILLING_CYCLES.find((c) => c === meta?.billing_cycle) ?? null;

    const now = Date.now();
    const trialEndsAt = new Date(now + TRIAL.trialDays * DAY);
    const deleteAt = new Date(now + TRIAL.deleteAfterDays * DAY);
    try {
      const vendor = await this.prisma.$transaction(async (tx) => {
        const v = await tx.vendors.create({
          data: {
            name: shopName,
            contact_email: email,
            contact_phone: phone,
            plan_status: 'trial',
            plan: picked,
            billing_cycle: picked ? (cycle ?? 'monthly') : null,
            trial_ends_at: trialEndsAt,
            delete_at: deleteAt,
            self_signup: true,
          },
          select: { id: true },
        });
        await tx.staff_users.create({
          data: { vendor_id: v.id, role: 'vendor_admin', name: ownerName, email, auth_user_id: claims.sub },
        });
        return v;
      });
      return this.result(vendor.id, trialEndsAt, deleteAt);
    } catch (err) {
      // two sign-up requests at once: the other one made the shop
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.prisma.staff_users.findUnique({
          where: { auth_user_id: claims.sub },
          select: { vendor_id: true, vendors: { select: { trial_ends_at: true, delete_at: true } } },
        });
        if (raced) return this.result(raced.vendor_id, raced.vendors.trial_ends_at, raced.vendors.delete_at);
        throw new ConflictException({ code: 'email_taken' });
      }
      throw err;
    }
  }

  private result(vendorId: string, trialEndsAt: Date | null, deleteAt: Date | null) {
    return { vendorId, trialEndsAt: trialEndsAt?.toISOString() ?? null, deleteAt: deleteAt?.toISOString() ?? null };
  }

  /**
   * Admin: the shop pays for a plan. It stays active for good (no trial, no deletion).
   * `founding` takes one of the Founding Merchant spots (409 founding_full when none are left);
   * leaving it out keeps the shop's current Founding status.
   */
  async activate(vendorId: string, plan: Plan, billingCycle: BillingCycle = 'monthly', founding?: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const v = await tx.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
      if (!v) throw new NotFoundException({ code: 'vendor_not_found' });
      if (founding) await this.plans.takeFoundingSpot(tx, vendorId);
      return tx.vendors.update({
        where: { id: vendorId },
        data: {
          plan_status: 'active',
          plan,
          billing_cycle: billingCycle,
          ...(founding === undefined ? {} : { founding }),
          trial_ends_at: null,
          delete_at: null,
          status: 'active',
        },
        select: PLAN_SELECT,
      });
    });
  }

  /** Admin: give a trial shop more days (from now or from its current end, whichever is later). */
  async extend(vendorId: string, days: number) {
    const v = await this.prisma.vendors.findUnique({
      where: { id: vendorId },
      select: { plan_status: true, trial_ends_at: true, delete_at: true },
    });
    if (!v) throw new NotFoundException({ code: 'vendor_not_found' });
    if (v.plan_status !== 'trial') throw new ConflictException({ code: 'not_on_trial', message: 'This shop is not on a trial.' });
    const from = Math.max(Date.now(), v.trial_ends_at?.getTime() ?? 0);
    const trialEndsAt = new Date(from + days * DAY);
    // the shop is never deleted before its new trial end
    const deleteAt = new Date(Math.max(v.delete_at?.getTime() ?? 0, trialEndsAt.getTime()));
    return this.prisma.vendors.update({
      where: { id: vendorId },
      data: { trial_ends_at: trialEndsAt, delete_at: deleteAt, status: 'active' },
      select: PLAN_SELECT,
    });
  }

  /** The background job: lock ended trials, delete overdue ones. Safe to run any time. */
  async run(now = new Date()): Promise<{ locked: number; deleted: string[] }> {
    const locked = await this.prisma.vendors.updateMany({
      where: { plan_status: 'trial', trial_ends_at: { lte: now }, status: 'active' },
      data: { status: 'suspended' },
    });
    const due = await this.prisma.vendors.findMany({
      where: { plan_status: 'trial', self_signup: true, delete_at: { lte: now } },
      select: { id: true, name: true },
    });
    const deleted: string[] = [];
    for (const v of due) {
      try {
        await this.purge(v.id);
        deleted.push(v.id);
        this.log.log(`Deleted unpaid trial shop "${v.name}" (${v.id}).`);
      } catch (err) {
        this.log.warn(`Could not delete trial shop ${v.id}: ${String(err)}`);
      }
    }
    return { locked: locked.count, deleted };
  }

  /**
   * Deletes a trial shop and everything it owns, in one transaction (same order as
   * database/delete_vendor.sql), then its images and its team's sign-in accounts. Customers are
   * deleted only when they have no card anywhere else and no sign-in. Refuses anything that is
   * not an unpaid self sign-up past its deletion date.
   */
  async purge(vendorId: string): Promise<void> {
    const staffLogins: string[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        const [v] = await tx.$queryRaw<{ ok: boolean }[]>`
          SELECT (plan_status = 'trial' AND self_signup AND delete_at <= now()) AS ok
          FROM vendors WHERE id = ${vendorId}::uuid FOR UPDATE`;
        if (!v?.ok) throw new Error('not an overdue self sign-up trial: not deleted');

        for (const s of await tx.staff_users.findMany({ where: { vendor_id: vendorId }, select: { auth_user_id: true } })) {
          if (s.auth_user_id) staffLogins.push(s.auth_user_id);
        }
        const customers = (await tx.cards.findMany({ where: { vendor_id: vendorId }, select: { user_id: true } })).map((c) => c.user_id);

        // the ledger refuses DELETE by design: switched off for this transaction only
        await tx.$executeRaw`ALTER TABLE point_events DISABLE TRIGGER point_events_no_update`;
        const id = vendorId;
        await tx.$executeRaw`DELETE FROM wallet_registrations WHERE card_id IN (SELECT id FROM cards WHERE vendor_id = ${id}::uuid)`;
        await tx.$executeRaw`DELETE FROM wallet_broadcast_recipients WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM wallet_broadcasts WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM wallet_campaigns WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM customer_segment_members WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM customer_segments WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM vendor_feedback WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM merchant_feedback WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM fraud_flags WHERE vendor_id = ${id}::uuid
          OR branch_id IN (SELECT b.id FROM branches b WHERE b.vendor_id = ${id}::uuid)
          OR staff_id IN (SELECT s.id FROM staff_users s WHERE s.vendor_id = ${id}::uuid)`;
        await tx.$executeRaw`DELETE FROM admin_actions WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM redemptions WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM point_events WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM qr_codes WHERE vendor_id = ${id}::uuid
          OR used_branch_id IN (SELECT b.id FROM branches b WHERE b.vendor_id = ${id}::uuid)
          OR used_by_staff_id IN (SELECT s.id FROM staff_users s WHERE s.vendor_id = ${id}::uuid)
          OR reward_id IN (SELECT r.id FROM rewards r WHERE r.vendor_id = ${id}::uuid)`;
        await tx.$executeRaw`DELETE FROM reward_sold_outs WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM vendor_images WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM cards WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`UPDATE loyalty_cards SET live_version_id = NULL WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM loyalty_card_versions WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM loyalty_cards WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM point_rules WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM rewards WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM staff_users WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM branches WHERE vendor_id = ${id}::uuid`;
        await tx.$executeRaw`DELETE FROM vendors WHERE id = ${id}::uuid`;
        await tx.$executeRaw`ALTER TABLE point_events ENABLE TRIGGER point_events_no_update`;

        // customers who now have no card anywhere and no sign-in of their own
        if (customers.length) {
          await tx.$executeRaw`DELETE FROM users u WHERE u.id = ANY(${customers}::uuid[])
            AND u.auth_user_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.user_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM qr_codes q WHERE q.user_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM fraud_flags f WHERE f.user_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id = u.id)`;
        }
        // other shops' cards and ledger rows are never touched, so their balances stay as they were
      },
      { timeout: 60_000 },
    );

    // after the commit: files and sign-in accounts (failures are logged, the shop is gone)
    try {
      const files = await this.storage.listFolder('vendors', vendorId);
      await this.storage.removeQuietly('vendors', files);
    } catch (err) {
      this.log.warn(`Trial shop ${vendorId}: images not removed (${String(err)})`);
    }
    for (const authUserId of staffLogins) {
      const stillUsed =
        (await this.prisma.staff_users.count({ where: { auth_user_id: authUserId } })) +
        (await this.prisma.platform_admins.count({ where: { auth_user_id: authUserId } })) +
        (await this.prisma.users.count({ where: { auth_user_id: authUserId } }));
      if (stillUsed) continue;
      try {
        await this.authAdmin.deleteUser(authUserId);
      } catch (err) {
        this.log.warn(`Trial shop ${vendorId}: sign-in ${authUserId} not deleted (${String(err)})`);
      }
    }
  }
}
