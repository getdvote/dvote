import { Injectable, NotFoundException } from '@nestjs/common';
import { fromMinor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { CardEventResponseDto, CardResponseDto } from './dto/card-response.dto';

/** A customer's cards (/api/app/cards). Only ever their own. */
@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest activity first; a vendor appears only after the first purchase there. */
  async list(userId: string): Promise<CardResponseDto[]> {
    const cards = await this.prisma.cards.findMany({
      where: { user_id: userId },
      include: {
        vendors: {
          select: { id: true, name: true, logo_url: true, currency: true },
        },
      },
      orderBy: { last_activity_at: 'desc' },
    });
    const rewards = await this.prisma.rewards.findMany({
      where: {
        vendor_id: { in: cards.map((c) => c.vendor_id) },
        status: 'active',
      },
      orderBy: [{ points_cost: 'asc' }, { sort_order: 'asc' }],
    });

    return cards.map((card) => {
      const own = rewards.filter((r) => r.vendor_id === card.vendor_id);
      const next = own.find((r) => r.points_cost > card.balance);
      return {
        id: card.id,
        vendor: {
          id: card.vendors.id,
          name: card.vendors.name,
          logoUrl: card.vendors.logo_url,
          currency: card.vendors.currency,
        },
        balance: card.balance,
        lifetimePoints: card.lifetime_points,
        affordableRewards: own.filter((r) => r.points_cost <= card.balance)
          .length,
        nextReward: next
          ? {
              id: next.id,
              name: next.name,
              nameAr: next.name_ar,
              pointsCost: next.points_cost,
              pointsNeeded: next.points_cost - card.balance,
            }
          : null,
        lastActivityAt: card.last_activity_at.toISOString(),
      };
    });
  }

  /** History of one of the customer's cards, newest first. */
  async events(
    userId: string,
    cardId: string,
    limit = 50,
  ): Promise<CardEventResponseDto[]> {
    const card = await this.prisma.cards.findFirst({
      where: { id: cardId, user_id: userId },
      select: { id: true },
    });
    if (!card) throw new NotFoundException({ code: 'card_not_found' });

    const events = await this.prisma.point_events.findMany({
      where: { card_id: card.id },
      include: {
        branches: { select: { name: true } },
        rewards: { select: { name: true, name_ar: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      delta: e.delta,
      purchaseAmount:
        e.purchase_amount === null
          ? null
          : fromMinor(toMinor(e.purchase_amount)),
      branchName: e.branches?.name ?? null,
      rewardName: e.rewards?.name ?? null,
      rewardNameAr: e.rewards?.name_ar ?? null,
      createdAt: e.created_at.toISOString(),
    }));
  }
}
