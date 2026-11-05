import { ForbiddenException } from '@nestjs/common';
import type { staff_role } from '../generated/prisma/client.js';
import { BILLING } from '../plans/plans';

const DAY = 24 * 60 * 60 * 1000;

interface VendorLockFields {
  status: string;
  plan_status: string | null;
  trial_ends_at: Date | null;
  delete_at: Date | null;
  paid_until: Date | null;
}

export interface VendorLock {
  code: 'trial_ended' | 'subscription_expired' | 'vendor_suspended';
  body: Record<string, unknown>;
}

/** Why a shop can't work right now, or null. The one place these rules live. */
export function vendorLock(v: VendorLockFields): VendorLock | null {
  // a free trial that has run out locks the whole shop (dashboard, scans) until a plan is active
  if (v.plan_status === 'trial' && v.trial_ends_at && v.trial_ends_at <= new Date()) {
    return {
      code: 'trial_ended',
      body: {
        code: 'trial_ended',
        message: 'The free trial has ended. Subscribe to a plan to continue.',
        trialEndedAt: v.trial_ends_at.toISOString(),
        deleteAt: v.delete_at?.toISOString() ?? null,
      },
    };
  }
  // a paid period that ran out: BILLING.graceDays of grace (dashboard warns), then locked until renewed
  if (v.plan_status === 'active' && v.paid_until && v.paid_until.getTime() + BILLING.graceDays * DAY <= Date.now()) {
    return {
      code: 'subscription_expired',
      body: {
        code: 'subscription_expired',
        message: 'The subscription has ended. Renew it to continue.',
        paidUntil: v.paid_until.toISOString(),
      },
    };
  }
  if (v.status !== 'active') return { code: 'vendor_suspended', body: { code: 'vendor_suspended' } };
  return null;
}

export interface StaffForAccess {
  status: string;
  role: staff_role;
  vendors: VendorLockFields;
  branches: { status: string } | null;
}

/** Everything a staff member needs to be allowed to work, for a sign-in or a paired phone. */
export function assertStaffCanWork(staff: StaffForAccess, allowed?: staff_role[]): void {
  if (staff.status !== 'active') {
    throw new ForbiddenException({ code: 'staff_disabled' });
  }
  const lock = vendorLock(staff.vendors);
  if (lock) throw new ForbiddenException(lock.body);
  if (staff.branches && staff.branches.status !== 'active') {
    throw new ForbiddenException({ code: 'branch_closed' });
  }
  if (allowed && !allowed.includes(staff.role)) {
    throw new ForbiddenException({ code: 'forbidden_role' });
  }
}
