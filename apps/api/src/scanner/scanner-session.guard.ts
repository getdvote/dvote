import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bearerToken } from '../auth/bearer-token';
import { assertStaffCanWork } from '../auth/staff-access';
import { STAFF_ROLES_KEY, StaffAuthGuard, type StaffRequest } from '../auth/staff-auth.guard';
import type { staff_role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_PREFIX, sha256 } from './scanner-token';

const ALLOW_PAUSED_KEY = 'scannerAllowPaused';
const LAST_USED_EVERY_MS = 60_000;

/** A route a paused phone may still call: ending its own session. */
export const AllowPausedSession = () => SetMetadata(ALLOW_PAUSED_KEY, true);

export interface ScannerRequest extends StaffRequest {
  scannerPairingId: string;
}

const ended = (reason?: string) => new UnauthorizedException({ code: 'scanner_session_ended', ...(reason ? { reason } : {}) });

/**
 * A paired phone's session token: same StaffContext and checks as the person who paired, but the
 * branch comes from the pairing. Only the scan routes and /scanner/me use this guard, so the token
 * is refused everywhere else (StaffAuthGuard verifies Supabase tokens only).
 * Ended (401) needs a new pairing. Paused (403) writes nothing and clears by itself.
 */
@Injectable()
export class ScannerSessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ScannerRequest>();
    const token = bearerToken(req);
    if (!token?.startsWith(SESSION_PREFIX)) throw ended();

    const pairing = await this.prisma.scanner_pairings.findUnique({
      where: { session_token_hash: sha256(token) },
      include: {
        branches: { select: { status: true } },
        staff_users: {
          include: {
            vendors: { select: { status: true, plan_status: true, trial_ends_at: true, delete_at: true, paid_until: true } },
            branches: { select: { status: true } },
          },
        },
      },
    });
    if (!pairing) throw ended();
    if (pairing.revoked_at) throw ended(pairing.revoked_reason ?? undefined);
    if (!pairing.session_expires_at || pairing.session_expires_at <= new Date()) throw ended('expired');

    // Staff changes revoke in the same transaction as the change. This catches any write that didn't.
    const staff = pairing.staff_users;
    const reason =
      staff.status !== 'active'
        ? 'staff_disabled'
        : staff.role === 'viewer'
          ? 'role_changed'
          : staff.branch_id && staff.branch_id !== pairing.branch_id
            ? 'branch_changed'
            : null;
    if (reason) {
      await this.prisma.scanner_pairings.update({
        where: { id: pairing.id },
        data: { revoked_at: new Date(), revoked_reason: reason },
      });
      throw ended(reason);
    }

    const targets = [context.getHandler(), context.getClass()];
    if (!this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_PAUSED_KEY, targets)) {
      // the pairing's branch counts, because a merchant admin has no branch of their own
      assertStaffCanWork(
        { ...staff, branches: pairing.branches },
        this.reflector.getAllAndOverride<staff_role[] | undefined>(STAFF_ROLES_KEY, targets),
      );
      const body = (req.body ?? {}) as { branchId?: unknown; previewBranchId?: unknown };
      for (const requested of [body.branchId, body.previewBranchId]) {
        if (requested !== undefined && requested !== pairing.branch_id) {
          throw new ForbiddenException({ code: 'forbidden_branch' });
        }
      }
    }

    if (!pairing.last_used_at || Date.now() - pairing.last_used_at.getTime() > LAST_USED_EVERY_MS) {
      await this.prisma.scanner_pairings.update({ where: { id: pairing.id }, data: { last_used_at: new Date() } });
    }
    req.scannerPairingId = pairing.id;
    req.staff = { staffId: staff.id, vendorId: staff.vendor_id, branchId: pairing.branch_id, role: staff.role };
    return true;
  }
}

/** The scan routes: a paired phone's session token, or a normal staff sign-in. */
@Injectable()
export class StaffOrScannerGuard implements CanActivate {
  constructor(
    private readonly staff: StaffAuthGuard,
    private readonly scanner: ScannerSessionGuard,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const token = bearerToken(context.switchToHttp().getRequest<StaffRequest>());
    return token?.startsWith(SESSION_PREFIX) ? this.scanner.canActivate(context) : this.staff.canActivate(context);
  }
}
