import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { qr_codes, qr_status } from '../generated/prisma/client.js';
import { fromMinor, toMinor } from '../points/points';
import { isSoldOutEverywhere } from '../rewards/reward-sold-outs.service';
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
   * purpose redeem: see createRedeem. Otherwise issues a one-time collect QR (valid 5 minutes). Any other active collect QR of this
   * customer is cancelled, so only the newest one on screen works. The master QR names no
   * vendor (the scanning staff's vendor gets the points); a shop QR (vendorId) only works at
   * that vendor. Unknown or suspended vendor: 404 vendor_not_found.
   */
  async create(
    userId: string,
    dto: CreateQrCodeDto,
  ): Promise<CreateQrCodeResponseDto> {
    if (dto.purpose === 'redeem') return this.createRedeem(userId, dto);
    if (dto.rewardId) throw new BadRequestException({ code: 'reward_not_allowed', message: 'rewardId is only for purpose redeem' });
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
      reward: null,
    };
  }

  /**
   * Issues a one-time redeem QR for a reward (valid 5 minutes). Checked now so the customer
   * isn't sent to the counter for nothing: the reward is active at an active shop, not sold
   * out at every open branch (reward_sold_out), and the
   * customer's card there has enough points. Checked again when staff confirm (the balance
   * may change meanwhile). The QR carries the reward's vendor: only that vendor's staff can
   * confirm it. A new redeem QR cancels the customer's previous one.
   */
  private async createRedeem(userId: string, dto: CreateQrCodeDto): Promise<CreateQrCodeResponseDto> {
    if (dto.vendorId) throw new BadRequestException({ code: 'vendor_not_allowed', message: 'vendorId is not allowed with purpose redeem' });
    const reward = await this.prisma.rewards.findUnique({
      where: { id: dto.rewardId! },
      include: { vendors: { select: { name: true, status: true } } },
    });
    if (!reward || reward.vendors.status !== 'active') throw new NotFoundException({ code: 'reward_not_found' });
    if (reward.status !== 'active') throw new ConflictException({ code: 'reward_unavailable' });
    // Sold out at some branches is fine (another may have it); at every open branch it isn't.
    if (await isSoldOutEverywhere(this.prisma, reward.id, reward.vendor_id)) throw new ConflictException({ code: 'reward_sold_out' });
    const card = await this.prisma.cards.findUnique({
      where: { user_id_vendor_id: { user_id: userId, vendor_id: reward.vendor_id } },
      select: { balance: true },
    });
    if ((card?.balance ?? 0) < reward.points_cost) throw new ConflictException({ code: 'insufficient_points' });

    const { code, tokenHash } = newQrCode();
    const qr = await this.prisma.$transaction(async (tx) => {
      await tx.qr_codes.updateMany({
        where: { user_id: userId, purpose: 'redeem', status: 'active' },
        data: { status: 'cancelled' },
      });
      return tx.qr_codes.create({
        data: { user_id: userId, purpose: 'redeem', vendor_id: reward.vendor_id, reward_id: reward.id, token_hash: tokenHash },
      });
    });
    return {
      id: qr.id,
      code,
      purpose: qr.purpose,
      vendorId: qr.vendor_id,
      expiresAt: qr.expires_at.toISOString(),
      reward: {
        id: reward.id,
        name: reward.name,
        nameAr: reward.name_ar,
        pointsCost: reward.points_cost,
        imageUrl: reward.image_url,
        vendorName: reward.vendors.name,
      },
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
            redemptions: { select: { reward_name: true, points_cost: true } },
            rewards: { select: { name_ar: true } },
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
      redeemResult:
        event && event.type === 'redeem'
          ? {
              rewardName: event.redemptions?.reward_name ?? '',
              rewardNameAr: event.rewards?.name_ar ?? null,
              pointsRedeemed: -event.delta,
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
