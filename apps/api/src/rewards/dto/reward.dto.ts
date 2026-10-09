import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { rewards } from '../../generated/prisma/client.js';
import { reward_status } from '../../generated/prisma/enums.js';

export class CreateRewardDto {
  @ApiProperty({ maxLength: 120, example: 'Free coffee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'قهوة مجانية', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string | null;

  @ApiPropertyOptional({ maxLength: 500, example: 'Any coffee, any size', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 500, example: 'أي قهوة، أي حجم', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string | null;

  @ApiProperty({ example: 300 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  pointsCost: number;

  @ApiPropertyOptional({ example: 1, description: 'Display order (low first)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

/**
 * Only sent fields change; nameAr/description/descriptionAr accept null to clear.
 * status=archived retires a reward (never deleted; past redemptions keep their snapshot).
 * A new pointsCost applies to future redemptions only.
 */
export class UpdateRewardDto extends PartialType(CreateRewardDto) {
  @ApiPropertyOptional({ enum: reward_status, enumName: 'RewardStatus' })
  @IsOptional()
  @IsIn(Object.values(reward_status))
  status?: reward_status;
}

export class RewardResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  vendorId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  nameAr: string | null;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true })
  descriptionAr: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Public link to the reward photo' })
  imageUrl: string | null;

  @ApiProperty({ example: 300 })
  pointsCost: number;

  @ApiProperty({ enum: reward_status, enumName: 'RewardStatus' })
  status: reward_status;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: string;

  static from(r: rewards): RewardResponseDto {
    return {
      id: r.id,
      vendorId: r.vendor_id,
      name: r.name,
      nameAr: r.name_ar,
      description: r.description,
      descriptionAr: r.description_ar,
      imageUrl: r.image_url,
      pointsCost: r.points_cost,
      status: r.status,
      sortOrder: r.sort_order,
      createdAt: r.created_at.toISOString(),
    };
  }
}
