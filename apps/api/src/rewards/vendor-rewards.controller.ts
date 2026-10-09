import { Body, Controller, Get, Param, Patch, Post, Delete, Put, UploadedFile } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
import { CreateRewardDto, RewardResponseDto, UpdateRewardDto } from './dto/reward.dto';
import { RewardsService } from './rewards.service';

/** My vendor's reward catalogue (vendor dashboard). Reading: admins + managers; changing: vendor_admin. */
@VendorApi('vendor: rewards')
@Controller('vendor/rewards')
export class VendorRewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: [RewardResponseDto] })
  async list(@CurrentStaff() ctx: StaffContext): Promise<RewardResponseDto[]> {
    return (await this.rewards.list(ctx.vendorId)).map((r) => RewardResponseDto.from(r));
  }

  @Post()
  @StaffRoles('vendor_admin')
  @ApiCreatedResponse({ type: RewardResponseDto })
  async create(@CurrentStaff() ctx: StaffContext, @Body() dto: CreateRewardDto): Promise<RewardResponseDto> {
    return RewardResponseDto.from(await this.rewards.create(ctx.vendorId, dto));
  }

  @Patch(':id')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: RewardResponseDto })
  @ApiNotFoundResponse({ description: 'reward_not_found (also for other vendors’ rewards)' })
  async update(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ): Promise<RewardResponseDto> {
    return RewardResponseDto.from(await this.rewards.update(id, dto, ctx.vendorId));
  }

  /** Upload or replace the reward photo (public; the previous file is deleted). */
  @Put(':id/image')
  @StaffRoles('vendor_admin')
  @ApiImageUpload()
  @ApiOkResponse({ type: RewardResponseDto })
  @ApiNotFoundResponse({ description: 'reward_not_found' })
  async setImage(
    @CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<RewardResponseDto> {
    return RewardResponseDto.from(await this.rewards.setImage(id, file.buffer, ctx.vendorId));
  }

  /** Remove the reward photo (the file is deleted from storage). */
  @Delete(':id/image')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: RewardResponseDto })
  @ApiNotFoundResponse({ description: 'reward_not_found' })
  async removeImage(@CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string): Promise<RewardResponseDto> {
    return RewardResponseDto.from(await this.rewards.removeImage(id, ctx.vendorId));
  }
}
