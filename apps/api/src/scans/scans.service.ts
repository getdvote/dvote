import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type qr_codes } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { fromMinor, pointsFor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { tokenHashOf } from '../qr-codes/qr-code.token';
import { CollectScanDto } from './dto/scan.dto';
import {
  CollectResponseDto,
  PreviewScanResponseDto,
} from './dto/scan-response.dto';

/** The ledger row + names needed to describe a collect result. */
const eventWithNames = {
  vendors: { select: { currency: true } },
  branches: { select: { name: true } },
  point_rules: { select: { version: true } },
} satisfies Prisma.point_eventsInclude;
type EventWithNames = Prisma.point_eventsGetPayload<{
  include: typeof eventWithNames;
}>;

/**
 * Staff side of QR codes (/api/vendor/scans): the server decides everything; the staff
 * app only sends the scanned code and the receipt total.
 */
@Injectable()
export class ScansService {
  constructor(private readonly prisma: PrismaService) {}

  /** What the scanned QR is and whether this staff member can use it. Changes nothing. */
  async preview(
    ctx: StaffContext,
    code: string,
  ): Promise<PreviewScanResponseDto> {
    const qr = await this.findQr(code);
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: qr.user_id },
      select: { status: true },
    });
    // A master collect QR names no vendor (the scanning staff's vendor gets the points);
    // a shop collect QR and a redeem QR only work at their own vendor.
    const reason =
      this.stateProblem(qr) ??
      (this.wrongVendor(qr, ctx) ? 'vendor_mismatch' : null) ??
      (user.status !== 'active' ? 'user_blocked' : null);
    return {
      purpose: qr.purpose,
      usable: reason === null,
      reason,
      expiresAt: qr.expires_at.toISOString(),
    };
  }

  /**
   * Adds points for a purchase. Checks run in a fixed order; any failure changes nothing
   * and the QR stays usable (so a typo can be corrected). Success is one transaction:
   * QR used + card (created on first purchase) + ledger row + balance.
   */
  async collect(
    ctx: StaffContext,
    dto: CollectScanDto,
  ): Promise<CollectResponseDto> {
    const qr = await this.findQr(dto.code);

    // A retry of a submit that already succeeded: return the first result.
    const replay = await this.replay(dto.idempotencyKey, qr.id);
    if (replay) return replay;

    const problem = this.stateProblem(qr);
    if (problem) throw new ConflictException({ code: problem });
    if (qr.purpose !== 'collect') {
      throw new BadRequestException({ code: 'wrong_qr_type' });
    }

    // A shop QR (made on that shop's page in the app) only works at that shop.
    if (this.wrongVendor(qr, ctx)) {
      throw new ForbiddenException({ code: 'vendor_mismatch' });
    }

    // Vendor and branch come only from the scanning staff member, never from the QR.
    const branch = await this.resolveBranch(ctx, dto.branchId);

    const [user, vendor, rule] = await Promise.all([
      this.prisma.users.findUniqueOrThrow({ where: { id: qr.user_id } }),
      this.prisma.vendors.findUniqueOrThrow({ where: { id: ctx.vendorId } }),
      this.prisma.point_rules.findFirst({
        where: { vendor_id: ctx.vendorId, is_active: true },
      }),
    ]);
    if (user.status !== 'active') {
      throw new ForbiddenException({ code: 'user_blocked' });
    }
    if (!rule) throw new ConflictException({ code: 'no_active_rule' });

    const amountMinor = toMinor(dto.amount);
    const points = pointsFor(amountMinor, {
      spendAmountMinor: toMinor(rule.spend_amount),
      pointsPerSpend: rule.points_per_spend,
      minPurchaseMinor: toMinor(rule.min_purchase),
      maxPointsPerPurchase: rule.max_points_per_purchase,
    });
    if (points <= 0) {
      throw new UnprocessableEntityException({
        code: 'no_points_earned',
        message:
          `Below one point: ${fromMinor(toMinor(rule.spend_amount))} ${vendor.currency} = ${rule.points_per_spend} point(s)` +
          (toMinor(rule.min_purchase) > 0
            ? `, minimum purchase ${fromMinor(toMinor(rule.min_purchase))} ${vendor.currency}`
            : ''),
      });
    }

    if (dto.receiptRef) {
      const used = await this.prisma.point_events.findFirst({
        where: {
          branch_id: branch.id,
          receipt_ref: dto.receiptRef,
          type: 'earn',
        },
        select: { id: true },
      });
      if (used) throw new ConflictException({ code: 'duplicate_receipt' });
    }

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        // Conditional: only one scan of this QR can ever get past this line.
        const marked = await tx.qr_codes.updateMany({
          where: {
            id: qr.id,
            status: 'active',
            expires_at: { gt: new Date() },
          },
          data: {
            status: 'used',
            used_at: new Date(),
            used_by_staff_id: ctx.staffId,
            used_branch_id: branch.id,
          },
        });
        if (marked.count !== 1)
          throw new ConflictException({ code: 'qr_used' });

        // First purchase at this vendor creates the card (race-safe).
        const [card] = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO cards (user_id, vendor_id) VALUES (${user.id}::uuid, ${vendor.id}::uuid)
          ON CONFLICT (user_id, vendor_id) DO UPDATE SET last_activity_at = now()
          RETURNING id`;

        const created = await tx.point_events.create({
          data: {
            card_id: card.id,
            vendor_id: vendor.id,
            branch_id: branch.id,
            type: 'earn',
            delta: points,
            purchase_amount: fromMinor(amountMinor),
            receipt_ref: dto.receiptRef ?? null,
            rule_id: rule.id,
            qr_code_id: qr.id,
            staff_id: ctx.staffId,
            idempotency_key: dto.idempotencyKey,
          },
          include: eventWithNames,
        });
        // Atomic SQL increments (balance = balance + n), in the same transaction.
        await tx.cards.update({
          where: { id: card.id },
          data: {
            balance: { increment: points },
            lifetime_points: { increment: points },
            last_activity_at: new Date(),
          },
        });
        return created;
      });
      return toResponse(event);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = JSON.stringify(err.meta ?? {});
        if (target.includes('idempotency')) {
          const first = await this.replay(dto.idempotencyKey, qr.id);
          if (first) return first;
        }
        if (target.includes('receipt')) {
          throw new ConflictException({ code: 'duplicate_receipt' });
        }
        throw new ConflictException({ code: 'qr_used' });
      }
      throw err;
    }
  }

  /** The QR names a vendor (shop QR or redeem) and it isn't the scanning staff's vendor. */
  private wrongVendor(qr: qr_codes, ctx: StaffContext): boolean {
    return qr.vendor_id !== null && qr.vendor_id !== ctx.vendorId;
  }

  private async findQr(code: string): Promise<qr_codes> {
    const hash = tokenHashOf(code);
    const qr = hash
      ? await this.prisma.qr_codes.findUnique({ where: { token_hash: hash } })
      : null;
    if (!qr) throw new NotFoundException({ code: 'qr_invalid' });
    return qr;
  }

  /** used / cancelled / expired, or null if the QR can still be used. */
  private stateProblem(qr: qr_codes): string | null {
    if (qr.status === 'used') return 'qr_used';
    if (qr.status === 'cancelled') return 'qr_cancelled';
    if (qr.status === 'expired' || qr.expires_at <= new Date()) {
      return 'qr_expired';
    }
    return null;
  }

  /**
   * The branch where the sale happens: always the staff member's own branch; vendor admins
   * (no branch) must name one of their vendor's active branches.
   */
  private async resolveBranch(ctx: StaffContext, requested?: string) {
    let branchId: string;
    if (ctx.role === 'vendor_admin') {
      if (!requested)
        throw new BadRequestException({ code: 'branch_required' });
      branchId = requested;
    } else {
      if (requested && requested !== ctx.branchId) {
        throw new ForbiddenException({ code: 'forbidden_branch' });
      }
      branchId = ctx.branchId!;
    }
    const branch = await this.prisma.branches.findFirst({
      where: { id: branchId, vendor_id: ctx.vendorId, status: 'active' },
    });
    if (!branch) throw new BadRequestException({ code: 'invalid_branch' });
    return branch;
  }

  /** The original result for a reused idempotency key (same QR only). */
  private async replay(
    key: string,
    qrId: string,
  ): Promise<CollectResponseDto | null> {
    const event = await this.prisma.point_events.findUnique({
      where: { idempotency_key: key },
      include: eventWithNames,
    });
    if (!event) return null;
    if (event.qr_code_id !== qrId || event.type !== 'earn') {
      throw new ConflictException({ code: 'idempotency_key_reused' });
    }
    return toResponse(event);
  }
}

function toResponse(event: EventWithNames): CollectResponseDto {
  return {
    pointEventId: event.id,
    pointsAdded: event.delta,
    purchaseAmount: fromMinor(toMinor(event.purchase_amount!)),
    currency: event.vendors.currency,
    ruleVersion: event.point_rules!.version,
    branchId: event.branch_id!,
    branchName: event.branches!.name,
    receiptRef: event.receipt_ref,
    at: event.created_at.toISOString(),
  };
}
