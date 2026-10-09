import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { qr_codes, qr_status } from '../generated/prisma/client.js';
import { fromMinor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import {
  CreateQrCodeResponseDto,
  QrCodeStatusResponseDto,
} from './dto/qr-code-response.dto';
import { newQrCode } from './qr-code.token';

/** Customer side of QR codes (/api/app/qr-codes). */
@Injectable()
export class QrCodesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues a one-time collect QR (valid 5 minutes). Any other active collect QR of this
   * customer is cancelled, so only the newest one on screen works. The master QR names no
   * vendor (the scanning staff's vendor gets the points); a shop QR (vendorId) only works at
   * that vendor. Unknown or suspended vendor: 404 vendor_not_found.
   */
  async create(
    userId: string,
    dto: CreateQrCodeDto,
  ): Promise<CreateQrCodeResponseDto> {
    if (dto.vendorId) {
      const vendor = await this.prisma.vendors.findFirst({
        where: { id: dto.vendorId, status: 'active' },
        select: { id: true, point_rules: { where: { is_active: true }, select: { id: true }, take: 1 } },
      });
      if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });
      // No points rule yet: no shop could give points with this QR, so don't issue it.
      if (vendor.point_rules.length === 0) {
        throw new ConflictException({ code: 'no_active_rule' });
      }
    }
    const { code, tokenHash } = newQrCode();
    const qr = await this.prisma.$transaction(async (tx) => {
      await tx.qr_codes.updateMany({
        where: { user_id: userId, purpose: dto.purpose, status: 'active' },
        data: { status: 'cancelled' },
      });
      return tx.qr_codes.create({
        data: {
          user_id: userId,
          purpose: dto.purpose,
          vendor_id: dto.vendorId ?? null,
          token_hash: tokenHash,
        },
      });
    });

    return {
      id: qr.id,
      code,
      purpose: qr.purpose,
      vendorId: qr.vendor_id,
      expiresAt: qr.expires_at.toISOString(),
    };
  }

  /** Polled by the app while the QR is on screen. */
  async status(userId: string, id: string): Promise<QrCodeStatusResponseDto> {
    const qr = await this.prisma.qr_codes.findFirst({
      where: { id, user_id: userId },
      include: {
        point_events: {
          include: {
            vendors: { select: { name: true, currency: true } },
            branches: { select: { name: true } },
            cards: { select: { balance: true } },
          },
        },
      },
    });
    if (!qr) throw new NotFoundException({ code: 'qr_not_found' });

    const event = qr.point_events;
    return {
      id: qr.id,
      purpose: qr.purpose,
      vendorId: qr.vendor_id,
      status: await this.effectiveStatus(qr),
      expiresAt: qr.expires_at.toISOString(),
      result:
        event && event.type === 'earn'
          ? {
              pointsAdded: event.delta,
              purchaseAmount: fromMinor(toMinor(event.purchase_amount!)),
              currency: event.vendors.currency,
              vendorId: event.vendor_id,
              vendorName: event.vendors.name,
              branchName: event.branches?.name ?? '',
              cardId: event.card_id,
              cardBalance: event.cards.balance,
              at: event.created_at.toISOString(),
            }
          : null,
    };
  }

  /** The customer closed the QR screen. Has no effect once the QR was used. */
  async cancel(userId: string, id: string): Promise<QrCodeStatusResponseDto> {
    const found = await this.prisma.qr_codes.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException({ code: 'qr_not_found' });
    await this.prisma.qr_codes.updateMany({
      where: { id, status: 'active' },
      data: { status: 'cancelled' },
    });
    return this.status(userId, id);
  }

  /** An active QR past its expiry is reported (and stored) as expired. */
  private async effectiveStatus(qr: qr_codes): Promise<qr_status> {
    if (qr.status !== 'active' || qr.expires_at > new Date()) return qr.status;
    await this.prisma.qr_codes.updateMany({
      where: { id: qr.id, status: 'active' },
      data: { status: 'expired' },
    });
    return 'expired';
  }
}
