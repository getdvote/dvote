import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { ParseUuidPipe } from '../common/uuid';
import type { users } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';

export class RewardHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ description: 'When the reward was given' }) at: string;
  @ApiProperty({ example: 'Joy Corner Smouha' }) branchName: string;
  @ApiProperty({ example: 300, description: 'Points it cost then (snapshot)' }) pointsCost: number;
  @ApiProperty({ example: 'Free coffee', description: 'Reward name then (snapshot)' }) rewardName: string;
}

export class RewardHistoryResponseDto {
  @ApiProperty({ description: 'How many times I redeemed this reward' }) count: number;
  @ApiProperty({ description: 'Points I spent on it in total' }) pointsSpent: number;
  @ApiProperty({ type: [RewardHistoryItemDto], description: 'Newest first (at most 50)' }) items: RewardHistoryItemDto[];
}

/**
 * The customer's own history with one reward (shown on the reward sheet): how many times they
 * redeemed it and when/where. Only their own redemptions, never anyone else's; a reward they
 * never redeemed (or an unknown id) is simply an empty history.
 */
@ApiTags('app: rewards')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'missing_token | invalid_token | token_expired' })
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/rewards')
export class AppRewardsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/history')
  @ApiOkResponse({ type: RewardHistoryResponseDto })
  async history(@CurrentUser() user: users, @Param('id', ParseUuidPipe) id: string): Promise<RewardHistoryResponseDto> {
    const where = { reward_id: id, cards: { user_id: user.id } };
    const [rows, totals] = await Promise.all([
      this.prisma.redemptions.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 50,
        include: { branches: { select: { name: true } } },
      }),
      this.prisma.redemptions.aggregate({ where, _count: true, _sum: { points_cost: true } }),
    ]);
    return {
      count: totals._count,
      pointsSpent: totals._sum.points_cost ?? 0,
      items: rows.map((r) => ({
        id: r.id,
        at: r.created_at.toISOString(),
        branchName: r.branches.name,
        pointsCost: r.points_cost,
        rewardName: r.reward_name,
      })),
    };
  }
}
