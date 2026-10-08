import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { CreateRewardDto, RewardResponseDto, UpdateRewardDto } from './dto/reward.dto';
import { RewardsService } from './rewards.service';

@AdminApi('admin: rewards')
@Controller('admin')
export class AdminRewardsController {
  constructor(private readonly rewards: RewardsService) {}

  /** The vendor's whole catalogue (active first, then archived). */
  @Get('vendors/:vendorId/rewards')
  @ApiOkResponse({ type: [RewardResponseDto] })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async list(@Param('vendorId', ParseUuidPipe) vendorId: string): Promise<RewardResponseDto[]> {
    return (await this.rewards.list(vendorId)).map((r) => RewardResponseDto.from(r));
  }

  @Post('vendors/:vendorId/rewards')
  @ApiCreatedResponse({ type: RewardResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async create(
    @Param('vendorId', ParseUuidPipe) vendorId: string,
    @Body() dto: CreateRewardDto,
  ): Promise<RewardResponseDto> {
    return RewardResponseDto.from(await this.rewards.create(vendorId, dto));
  }

  /** Edit (texts, price, order) or archive / restore (status). */
  @Patch('rewards/:id')
  @ApiOkResponse({ type: RewardResponseDto })
  @ApiNotFoundResponse({ description: 'reward_not_found' })
  async update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateRewardDto): Promise<RewardResponseDto> {
    return RewardResponseDto.from(await this.rewards.update(id, dto));
  }
}
