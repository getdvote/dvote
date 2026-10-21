import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, NotEquals } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';

export class AdjustCardDto {
  @ApiProperty({ example: -50, description: 'Points to add (positive) or take away (negative); never 0' })
  @IsInt()
  @NotEquals(0)
  @Min(-1_000_000)
  @Max(1_000_000)
  delta: number;

  @ApiProperty({ example: 'Staff typed 950 instead of 95', minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: 'Same key twice = applied once (safe to retry)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey?: string;
}

export class ReversePointEventDto {
  @ApiProperty({ example: 'Mistyped bill: 950 instead of 95', minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class AdjustResultDto {
  @ApiProperty({ format: 'uuid' }) pointEventId: string;
  @ApiProperty({ format: 'uuid' }) cardId: string;
  @ApiProperty() delta: number;
  @ApiProperty() cardBalance: number;
  @ApiProperty() lifetimePoints: number;
  @ApiProperty() reason: string;
  @ApiProperty() at: string;
}

/** The idempotency key of the adjust row that reverses an earn: one reversal per earn, ever. */
export const reverseKey = (eventId: string) => `reverse:${eventId}`;

/**
 * Admin point corrections. Every change is a new `adjust` row in the ledger (never an edit),
 * written in the same transaction as the card balance, which can never go below 0.
 */
@Injectable()
export class PointAdjustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
  ) {}

  /** Add or take away points on one card, with a reason. */
  adjust(adminId: string, cardId: string, dto: AdjustCardDto): Promise<AdjustResultDto> {
    const key = dto.idempotencyKey ? `admin:${dto.idempotencyKey}` : `admin:${randomUUID()}`;
    return this.apply(adminId, cardId, dto.delta, dto.reason.trim(), key);
  }

  /** Undo a (mistyped) collect: take back exactly the points it gave. Only once per collect. */
  async reverse(adminId: string, eventId: string, dto: ReversePointEventDto): Promise<AdjustResultDto> {
    const event = await this.prisma.point_events.findUnique({
      where: { id: eventId },
      select: { id: true, type: true, delta: true, card_id: true },
    });
    if (!event) throw new NotFoundException({ code: 'point_event_not_found' });
    if (event.type !== 'earn') {
      throw new ConflictException({ code: 'not_reversible', message: 'Only collects (earn) can be undone' });
    }
    const done = await this.prisma.point_events.findUnique({
      where: { idempotency_key: reverseKey(eventId) },
      select: { id: true },
    });
    if (done) throw new ConflictException({ code: 'already_reversed' });
    return this.apply(adminId, event.card_id, -event.delta, dto.reason.trim(), reverseKey(eventId));
  }

  private async apply(adminId: string, cardId: string, delta: number, reason: string, key: string): Promise<AdjustResultDto> {
    const card = await this.prisma.cards.findUnique({
      where: { id: cardId },
      select: { id: true, user_id: true, vendor_id: true },
    });
    if (!card) throw new NotFoundException({ code: 'card_not_found' });

    // A retried request with the same key returns the first result.
    const replay = await this.prisma.point_events.findUnique({ where: { idempotency_key: key } });
    if (replay) {
      if (replay.card_id !== cardId || replay.type !== 'adjust') {
        throw new ConflictException({ code: 'idempotency_key_reused' });
      }
      const now = await this.prisma.cards.findUniqueOrThrow({ where: { id: cardId } });
      return this.result(replay, now.balance, now.lifetime_points);
    }

    try {
      const { event, balance, lifetime } = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ balance: number; lifetime_points: number }[]>`
          UPDATE cards
             SET balance = balance + ${delta},
                 lifetime_points = GREATEST(lifetime_points + ${delta}, 0),
                 updated_at = now()
           WHERE id = ${cardId}::uuid AND balance + ${delta} >= 0
       RETURNING balance, lifetime_points`;
        if (rows.length === 0) throw new ConflictException({ code: 'insufficient_points' });
        const ev = await tx.point_events.create({
          data: {
            type: 'adjust',
            delta,
            card_id: cardId,
            vendor_id: card.vendor_id,
            created_by: adminId,
            reason,
            idempotency_key: key,
          },
        });
        return { event: ev, balance: rows[0].balance, lifetime: rows[0].lifetime_points };
      });
      this.live.cardsChanged(card.user_id);
      return this.result(event, balance, lifetime);
    } catch (e) {
      // Two requests with the same key at once: the second hits the unique key.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: key.startsWith('reverse:') ? 'already_reversed' : 'idempotency_key_reused' });
      }
      throw e;
    }
  }

  private result(
    e: { id: string; card_id: string; delta: number; reason: string | null; created_at: Date },
    balance: number,
    lifetime: number,
  ): AdjustResultDto {
    return {
      pointEventId: e.id,
      cardId: e.card_id,
      delta: e.delta,
      cardBalance: balance,
      lifetimePoints: lifetime,
      reason: e.reason ?? '',
      at: e.created_at.toISOString(),
    };
  }
}
