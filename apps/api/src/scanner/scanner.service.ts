import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { vendorLock } from '../auth/staff-access';
import { PrismaService } from '../prisma/prisma.service';
import type { PairingClaimedDto, PairingCreatedDto, ScannerPairingViewDto } from './dto/scanner.dto';
import { hashCode, newPairCode, newPairSecret, newSessionToken, sameHash, sha256 } from './scanner-token';

export const PAIRING = { codeMinutes: 5, sessionHours: 12, maxAttempts: 5 } as const;

/** Who a person may see and disconnect: their own phones, their branch's, or the whole shop's. */
function manageScope(ctx: StaffContext): Prisma.scanner_pairingsWhereInput {
  if (ctx.role === 'vendor_admin') return { vendor_id: ctx.vendorId };
  if (ctx.role === 'branch_manager') return { vendor_id: ctx.vendorId, branch_id: ctx.branchId! };
  return { vendor_id: ctx.vendorId, staff_id: ctx.staffId };
}

@Injectable()
export class ScannerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: StaffContext, branchId: string): Promise<PairingCreatedDto> {
    if (ctx.branchId && ctx.branchId !== branchId) {
      throw new ForbiddenException({ code: 'forbidden_branch' });
    }
    const branch = await this.prisma.branches.findFirst({
      where: { id: branchId, vendor_id: ctx.vendorId, status: 'active' },
      select: { name: true },
    });
    if (!branch) throw new BadRequestException({ code: 'invalid_branch' });

    const secret = newPairSecret();
    const code = newPairCode();
    const seconds = PAIRING.codeMinutes * 60;
    const expiresAt = new Date(Date.now() + seconds * 1000);
    const row = await this.prisma.$transaction(async (tx) => {
      // a new code replaces this person's unused one, and never touches paired phones
      await tx.scanner_pairings.updateMany({
        where: { staff_id: ctx.staffId, claimed_at: null, revoked_at: null, code_expires_at: { gt: new Date() } },
        data: { code_expires_at: new Date() },
      });
      return tx.scanner_pairings.create({
        data: {
          vendor_id: ctx.vendorId,
          branch_id: branchId,
          staff_id: ctx.staffId,
          secret_hash: sha256(secret),
          code_hash: hashCode(secret, code),
          code_expires_at: expiresAt,
        },
      });
    });
    return { id: row.id, secret, code, branchName: branch.name, expiresAt: expiresAt.toISOString(), expiresInSeconds: seconds };
  }

  async list(ctx: StaffContext): Promise<ScannerPairingViewDto[]> {
    const now = new Date();
    const rows = await this.prisma.scanner_pairings.findMany({
      where: {
        AND: [
          manageScope(ctx),
          { revoked_at: null },
          {
            OR: [
              { session_expires_at: { gt: now } },
              // a code in progress is only useful to the person who asked for it
              { staff_id: ctx.staffId, claimed_at: null, code_expires_at: { gt: now }, failed_attempts: { lt: PAIRING.maxAttempts } },
            ],
          },
        ],
      },
      include: {
        branches: { select: { name: true, status: true } },
        staff_users: { select: { name: true } },
        vendors: { select: { status: true, plan_status: true, trial_ends_at: true, delete_at: true, paid_until: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => {
      const pauseReason = !r.claimed_at ? null : (vendorLock(r.vendors)?.code ?? (r.branches.status !== 'active' ? 'branch_closed' : null));
      return {
        id: r.id,
        state: !r.claimed_at ? 'pending' : pauseReason ? 'paused' : 'active',
        pauseReason,
        deviceLabel: r.device_label,
        branchId: r.branch_id,
        branchName: r.branches.name,
        staffName: r.staff_users.name,
        claimedAt: r.claimed_at?.toISOString() ?? null,
        sessionExpiresAt: r.session_expires_at?.toISOString() ?? null,
        lastUsedAt: r.last_used_at?.toISOString() ?? null,
      };
    });
  }

  async disconnect(ctx: StaffContext, id: string): Promise<void> {
    const found = await this.prisma.scanner_pairings.findFirst({ where: { AND: [manageScope(ctx), { id }] }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'pairing_not_found' });
    await this.prisma.scanner_pairings.updateMany({
      where: { id, revoked_at: null },
      data: { revoked_at: new Date(), revoked_reason: 'disconnected', revoked_by_staff_id: ctx.staffId },
    });
  }

  /** The phone's only branch, from its guarded context. */
  branchOf(ctx: StaffContext): Promise<{ id: string; name: string }> {
    return this.prisma.branches.findFirstOrThrow({
      where: { id: ctx.branchId!, vendor_id: ctx.vendorId },
      select: { id: true, name: true },
    });
  }

  /** The phone's End session. Not a staff action, so no staff id. */
  async endByPhone(id: string): Promise<void> {
    await this.prisma.scanner_pairings.updateMany({
      where: { id, revoked_at: null },
      data: { revoked_at: new Date(), revoked_reason: 'ended_by_phone' },
    });
  }

  /** The row lock makes wrong tries and two right claims exact. Every failure answers the same. */
  async claim(secret: string, code: string, deviceLabel?: string): Promise<PairingClaimedDto> {
    const secretHash = sha256(secret);
    const given = hashCode(secret, code);
    const session = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<
        { id: string; code_hash: string; failed_attempts: number; claimed_at: Date | null; revoked_at: Date | null; code_expires_at: Date }[]
      >`SELECT id, code_hash, failed_attempts, claimed_at, revoked_at, code_expires_at
        FROM scanner_pairings WHERE secret_hash = ${secretHash} FOR UPDATE`;
      const usable =
        row && !row.claimed_at && !row.revoked_at && row.code_expires_at > new Date() && row.failed_attempts < PAIRING.maxAttempts;
      if (!usable) return null;
      if (!sameHash(row.code_hash, given)) {
        await tx.scanner_pairings.update({ where: { id: row.id }, data: { failed_attempts: { increment: 1 } } });
        return null; // returned, not thrown: throwing would roll the count back
      }
      const sessionToken = newSessionToken();
      const expiresAt = new Date(Date.now() + PAIRING.sessionHours * 3_600_000);
      await tx.scanner_pairings.update({
        where: { id: row.id },
        data: { session_token_hash: sha256(sessionToken), claimed_at: new Date(), session_expires_at: expiresAt, device_label: deviceLabel?.trim() || null },
      });
      return { sessionToken, expiresAt: expiresAt.toISOString() };
    });
    if (!session) throw new BadRequestException({ code: 'pairing_invalid', message: 'This code is not valid.' });
    return session;
  }
}
